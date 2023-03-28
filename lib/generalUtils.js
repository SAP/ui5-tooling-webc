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

module.exports = {
    getAliases,
    getReverseAliases
};
