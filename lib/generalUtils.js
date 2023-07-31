const fs = require("fs").promises;
const path = require("path");
const process = require("process");

// Aliases for the project and all its dependencies
const getAliases = customConfigurations => {
    let aliases = {
        "^(.*?)\/sap\/ui\/core\/(.*?)\.js$": "sap/ui/core/$2", // eslint-disable-line
        "^(.*?)\/sap\/base\/(.*?)\.js$": "sap/base/$2" // eslint-disable-line
    };

    customConfigurations.forEach(customConfig => {
       if (customConfig && customConfig["ui5-tooling-webc"]) {
           const packages = customConfig["ui5-tooling-webc"].packages || {};
           for (const packageName in packages) {
               const packageData = packages[packageName];
               aliases = { ...aliases, ...packageData.aliases };
           }
       }
    });

    return aliases;
}

// Reverse aliases for the project and all its dependencies
const getReverseAliases = (customConfigurations, processInternalLibraries = false) => {
    let reverseAliases = {};

    customConfigurations.forEach(customConfig => {
        if (customConfig && customConfig["ui5-tooling-webc"]) {
            const includeLibrary = processInternalLibraries || !customConfig["ui5-tooling-webc"].isInternalLibrary;
            const packages = includeLibrary ? (customConfig["ui5-tooling-webc"].packages || {}) : {};

            for (const packageName in packages) {
                const packageData = packages[packageName];
                reverseAliases = { ...reverseAliases, ...packageData.reverseAliases };
            }
        }
    });

    return reverseAliases;
};

// Reverse aliases for the project and all its dependencies
const getCyclicDependencies = (customConfigurations) => {
    let cyclicDependencies = {};

    customConfigurations.forEach(customConfig => {
        if (customConfig && customConfig["ui5-tooling-webc"]) {
            const packages = customConfig["ui5-tooling-webc"].packages

            for (const packageName in packages) {
                const packageData = packages[packageName];
                if (typeof packageData.cyclicDependencies === "object") {
                    cyclicDependencies = { ...cyclicDependencies, ...packageData.cyclicDependencies };
                }
            }
        }
    });

    return cyclicDependencies;
};

// Extra paths to use for "resolve" when dealing with NPM packages using the "file:" protocol
const getExtraResolvePaths = async (projectDir = process.cwd()) => {
    const findFileDeps = async (dir, paths) => {
        const pkgJson = require(path.join(dir, "package.json"));
        if (pkgJson.dependencies) {
            const promises = Object.values(pkgJson.dependencies).map(async dep => {
                const parts = /^file:(.*)/g.exec(dep);
                if (parts) {
                    const depDir = path.resolve(dir, parts[1]);
                    try {
                        if (await fs.stat(depDir)) {
                            await findFileDeps(depDir);
                            paths.push(path.join(depDir, "node_modules"));
                        }
                    } catch (e) {}
                }
            });
            await Promise.all(promises);
        }
    }

    const paths = [];
    await findFileDeps(projectDir, paths);
    return paths;
};

module.exports = {
    getAliases,
    getReverseAliases,
    getCyclicDependencies,
    getExtraResolvePaths
};
