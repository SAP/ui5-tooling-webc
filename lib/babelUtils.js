const fs = require("fs").promises;
const path = require("path");
const babel = require("@babel/core");
const resolveAsync = require("resolve/async");
const getPackagePath = require("./getPackagePath");

const resolvePromise = async (module, options) => {
    return new Promise((resolve, reject) => {
        resolveAsync(module, options, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
};

// helper function to resolve a modulePath to an aliasPath
const resolve = (modulePath, aliases) => {
    let resolvedPath = modulePath;

    for (const i in aliases) {
        resolvedPath = resolvedPath.replace(new RegExp(i), aliases[i]);
    }
    return resolvedPath;
}

const wrapDeps = (moduleCode, moduleName, aliases) => {
    // Get the absolute path of the module
    if (!moduleName.includes("node_modules/")) {
        return moduleCode;
    }
    const modulePath = resolve(moduleName.split("node_modules/")[1], aliases);

    // Find the module paths and deps
    const matches = moduleCode.match(/sap\.ui\.define\(\s*\[\s*(.*)\s*\]\s*,\s*function\s*\((.*)\)/);
    if (!matches) {
        return moduleCode;
    }

    const modulesPaths = matches[1].split(",").map(x => x.trim().replace(/"/g, "")).slice(1);
    if (modulesPaths[0] !== "exports") {
        return moduleCode;
    }
    const dependencies = matches[2].split(",").map(x => x.trim()).slice(1);

    // Map all dependencies to their modules' paths
    const depsToModulesMap = new Map();
    dependencies.forEach((dep, i) => {
        const fullPath = path.join(modulePath, modulesPaths[i]);
        depsToModulesMap.set(dep, fullPath);
    })

    // Find where the module function body starts
    const moduleBodyIndex = moduleCode.indexOf("{");

    const varsString = dependencies.join("|");
    const varsRe = new RegExp(`([^a-zA-Z0-9_$])(${varsString})([^a-zA-Z0-9_$])`, "g");
    // Only replace inside the module function body
    moduleCode = moduleCode.substring(0, moduleBodyIndex) +
        moduleCode.substring(moduleBodyIndex).replace(varsRe, (match, before, dep, after) => {
            const modulePath = depsToModulesMap.get(dep);
            const replacement = `(${dep} || (${dep} = sap.ui.require("${modulePath}")))`;
            return `${before}${replacement}${after}`;
        });

    return moduleCode;
};

const getExternalFile = async (resourcePath, reverseAliases, extraResolvePaths = []) => {
    let file;

    // If any of the reverse aliases matches, then this is an external file
    for (const i in reverseAliases) {
        if (new RegExp(i).test(resourcePath)) {
            file = resourcePath.replace(new RegExp(i), reverseAliases[i]);
            break;
        }
    }

    // No match found -> no extra work needed for this resource
    if (!file) {
        return;
    }

    // When a json file is required, the server will always add ".js" -> fix this
    file = file.replace(/\.json\.js$/, ".json");

    // TODO: fix this - must be ideally the node_modules/ directory with the shims
    file = await resolvePromise(file, {
        basedir: `node_modules/`, // this path will be resolved relatively to the project that is running the middleware, this is not the node_modules/ directory of the ui5-tooling-webc project
        paths: extraResolvePaths
    });

    // True path without sym links
    return fs.realpath(file);
};

const processWithBabel = async (code, aliases) => {
    const output = await babel.transformAsync(code, {
        // Babel plugins are resolved from the node_modules/ directory of the project that is executed, so we must explicitly point to the node_modules/ directory of ui5-tooling-webc here
        plugins: [
            ["module-resolver", {
                extensions: [".js"],
                resolvePath(sourcePath, currentFile, opts) {
                    return resolve(sourcePath, aliases).replace(/\.js$/, "");
                }
            }],
            "transform-dynamic-import",
            "@babel/plugin-transform-modules-amd"
        ]
    });

    return output.code;
};

const getCSS = async file => {
    return `${await fs.readFile(file)}`;
}

const getJS = async (file, aliases) => {
    let code = `${await fs.readFile(file)}`;

    // 1. Fix import.meta.url
    code = code.replace("import.meta.url", `""`);

    // 2. Run babel
    code = await processWithBabel(code, aliases);

    // 3. sap.ui.define
    code = code.replace(/^define/, "sap.ui.define");

    // 4. wrap dependencies in sap.ui.require
    code = wrapDeps(code, file, aliases);

    // 4. Fix dynamic imports
    if (file.includes("json-imports")) {
        code = code.replace(/sap\.ui\.define\(\[(.*?)\], function \((.*?)\) \{/, `sap.ui.define(['require', $1], function (require, $2) {`); // import the require function
        code = code.replace(/require\((.*?)\)/g, `new Promise(resolve => require([$1], resolve))`); // use require properly for UI5
    }

    return code;
}

// JSON files need to just be converted to JS with a default export
const getJSON = async file => {
    let data = JSON.parse(await fs.readFile(file));
    data = data._ || data;
    return `sap.ui.define(['exports'], function(exports) {  'use strict'; exports["default"] = ${JSON.stringify(data)}; })`;
}

const getEmptyJS = () => {
    return `sap.ui.define([], function() { 'use strict'; })`;
}

const getExternalModuleData = async (file, aliases) => {
    if (file.endsWith(".css")) {
        return {
            code: await getCSS(file),
            mime: "text/css; charset=UTF-8"
        };
    }

    if (file.endsWith(".json")) {
        return {
            code: await getJSON(file),
            mime: "application/javascript; charset=UTF-8" // Note: both .json and .js files end up served as .js
        };
    }

    return {
        code: await getJS(file, aliases),
        mime: "application/javascript; charset=UTF-8"
    };
};

const generateAll = async (packageName, conf, aliases) => {
    const { globby } = await import("globby");

    const packagePath = await getPackagePath(packageName);
    const absoluteInputPath = path.join(packagePath, conf.inputPath).replace(/\\/g, "/");
    const filters = conf.inputPathFilters.map(filter => {
        if (filter.startsWith("!")) {
            return `!${absoluteInputPath}${filter.substr(1)}`;
        }
        return `${absoluteInputPath}${filter}`;
    });

    const input = await globby(filters);

    return Promise.all(input.map(async fileName => {
        const relativeFileName = fileName.substr(absoluteInputPath.length);

        // JSON -> .json.js
        if (relativeFileName.endsWith(".json")) {
            return {
                fileName: relativeFileName + ".js",
                code: await getJSON(fileName)
            };
        }

        // CSS -> .css
        if (relativeFileName.endsWith(".css")) {
            return {
                fileName: relativeFileName,
                code: await getCSS(fileName)
            };
        }

        // JS - empty file
        if ((conf.emptyModules || []).some(emptyModule => relativeFileName.includes(emptyModule))) {
            return {
                fileName: relativeFileName,
                code: getEmptyJS()
            }
        }

        // JS - standard
        return {
            fileName: relativeFileName,
            code: await getJS(fileName, aliases)
        };
    }));
};

module.exports = {
    getExternalFile,
    getExternalModuleData,
    generateAll
};
