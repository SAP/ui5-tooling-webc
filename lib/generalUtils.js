const getPackages = (dependencies, project) => {
    let packages = {};

    function findDependencies(o) {
        const readers = o?._readers;
        if (readers) {
            readers.forEach(findDependencies);
        }

        const customConfig = o?._project?.customConfiguration;
        if (customConfig && customConfig["ui5-tooling-webc"]) {
            packages = { ...packages, ...customConfig["ui5-tooling-webc"].packages };
        }
    }
    findDependencies(dependencies);

    if (project) {
        const customConfig = project.customConfiguration;
        if (customConfig && customConfig["ui5-tooling-webc"]) {
            packages = { ...packages, ...customConfig["ui5-tooling-webc"].packages };
        }
    }

    return packages;
};

// Aliases for the project and all its dependencies
const getAliases = packages => {
    let aliases = {
        "^(.*?)\/sap\/ui\/core\/(.*?)\.js$": "sap/ui/core/$2", // eslint-disable-line
        "^(.*?)\/sap\/base\/(.*?)\.js$": "sap/base/$2" // eslint-disable-line
    };

    for (const packageName in packages) {
        const packageData = packages[packageName];
        aliases = { ...aliases, ...packageData.aliases };
    }

    return aliases;
}

// Reverse aliases for the project and all its dependencies
const getReverseAliases = packages => {
    let reverseAliases = {};

    for (const packageName in packages) {
        const packageData = packages[packageName];
        reverseAliases = { ...reverseAliases, ...packageData.reverseAliases };
    }

    return reverseAliases;
};

module.exports = {
    getAliases,
    getReverseAliases,
    getPackages
};
