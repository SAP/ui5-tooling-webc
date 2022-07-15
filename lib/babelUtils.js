const fs = require("fs").promises;
const babel = require("@babel/core");
const resolveAsync = require("resolve/async");

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

const getExternalFile = async (resourcePath, reverseAliases) => {
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
        basedir: `node_modules/` // this path will be resolved relatively to the project that is running the middleware, this is not the node_modules/ directory of the ui5-tooling-webc project
    });

    // True path without sym links
    return fs.realpath(file);
};

const processWithBabel = async (code, aliases) => {
    // helper function to resolve a modulePath to an aliasPath
    function resolve(modulePath) {
        let resolvedPath = modulePath;

        for (const i in aliases) {
            resolvedPath = resolvedPath.replace(new RegExp(i), aliases[i]);
        }
        return resolvedPath;
    }

    const output = await babel.transformAsync(code, {
        // Babel plugins are resolved from the node_modules/ directory of the project that is executed, so we must explicitly point to the node_modules/ directory of ui5-tooling-webc here
        plugins: [
            ["module-resolver", {
                extensions: [".js"],
                resolvePath(sourcePath, currentFile, opts) {
                    return resolve(sourcePath).replace(/\.js$/, "");
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

const generateAll = async (conf, aliases) => {
    const { globby } = await import("globby");

    const inputPath = conf.inputPath;
    const filters = conf.inputPathFilters.map(filter => {
        if (filter.startsWith("!")) {
            return `!${inputPath}${filter.substr(1)}`;
        }
        return `${inputPath}${filter}`;
    });

    const input = await globby(filters);

    return Promise.all(input.map(async fileName => {
        const relativeFileName = fileName.substr(inputPath.length);

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
