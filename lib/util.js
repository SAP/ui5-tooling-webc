const micromatch = require("micromatch");
const babel = require("@babel/core");

const DEFAULT_ALIASES = [

    // replace references to sap.ui.core
    { search: /^(.*?)\/sap\/ui\/core\/(.*?)\.js$/, replace: "sap/ui/core/$2" },

    // replace references to sap.ui.core
    { search: /^@ui5\/webcomponents-base\/dist\/(.*?)/, replace: "sap/ui/webc/common/thirdparty/base/$1" },
    { search: /^@ui5\/webcomponents-theme-base\/dist\/(.*?)/, replace: "sap/ui/webc/common/thirdparty/theme-base/$1" },
    { search: /^@ui5\/webcomponents-theming\/dist\/(.*?)/, replace: "sap/ui/webc/common/thirdparty/theming/$1" },
    { search: /^@ui5\/webcomponents-localization\/dist\/(.*?)/, replace: "sap/ui/webc/common/thirdparty/localization/$1" },
    { search: /^@ui5\/webcomponents-icons\/dist\/(.*?)/, replace: "sap/ui/webc/common/thirdparty/icons/$1" },
    { search: /^@ui5\/webcomponents-icons-tnt\/dist\/(.*?)/, replace: "sap/ui/webc/common/thirdparty/icons-tnt/$1" },

    // replace @ui5/webcomponents-main and @ui5/webcomponents-fiori modules
    { search: /^@ui5\/webcomponents\/dist\/(.*?)/, replace: "sap/ui/webc/main/thirdparty/$1" },
    { search: /^@ui5\/webcomponents-fiori\/(.*?)/, replace: "sap/ui/webc/fiori/thirdparty/$1" },

    // third parties such as: lit-html
    { search: /^lit-html\/(.*?)/, replace: "sap/ui/webc/common/thirdparty/lit-html/$1" }

];

function createDependency(reader) {
    const _reader = reader;

    const _excludes = [];
    const _aliases = [];

    const config = _reader._project.customConfiguration["ui5-tooling-webc"];
    if (config.excludes && Array.isArray(config.excludes)) {
        // TODO: check for excludes being a proper glob
        _excludes.push(...config.excludes);
    }
    if (config.aliases && Array.isArray(config.aliases)) {
        // TODO: check for search and replace
        _aliases.push(...config.aliases);
    }

    function isExcluded(reqPath) {
        return micromatch(reqPath, _excludes).length > 0;
    }

    return {
        byGlob: async function (glob, options) {
            const resources = await _reader.byGlob(glob, options);
            return resources?.filter(resource => {
                return !isExcluded(resource.getPath());
            });
        },
        byPath: async function (path, options) {
            if (!isExcluded(path)) {
                const resource = await _reader.byPath(path, options);
                return resource;
            }
        },
        getAliases: function getAliases() {
            return _aliases;
        }
    };
}

module.exports = {

    createHelper: function (dependencies) {
        // find the Web Component dependencies
        const _dependencies = [];
        function findDependencies(o) {
            if (o?._readers) {
                o._readers.forEach(findDependencies);
            }
            // only return the dependencies of Web Components
            // having a customConfiguration for "ui5-tooling-webc"
            const customConfig = o?._project?.customConfiguration;
            if (customConfig && customConfig["ui5-tooling-webc"]) {
                _dependencies.push(createDependency(o));
            }
        }
        findDependencies(dependencies);

        // create the aliases list to rename imports
        const _aliases = [...DEFAULT_ALIASES];
        _dependencies.forEach(dep => {
            _aliases.push(...dep.getAliases());
        });

        // helper function to resolve a modulePath to an aliasPath
        function resolve(modulePath) {
            let resolvedPath = modulePath;
            _aliases.forEach(({ search, replace }) => {
                resolvedPath = resolvedPath.replace(search, replace);
            });
            return resolvedPath;
        }

        return {
            byGlob: async function (glob, options) {
                const resources = [];
                await Promise.all(_dependencies.map(async (dep) => {
                    return dep.byGlob(glob, options);
                })).then((deps) => {
                    deps.forEach(res => {
                        res && resources.push(...res);
                    });
                });
                return resources;
            },
            byPath: async function (path, options) {
                const resources = await Promise.all(_dependencies.map(async (dep) => {
                    return dep.byPath(path, options);
                }));
                return resources.filter(resource => resource != null).shift();
            },
            transpile: async function transpile(resource) {
                const code = await resource.getString();
                return babel.transformAsync(code, {
                    plugins: [
                        ["module-resolver", {
                            extensions: [".js"],
                            resolvePath(sourcePath, currentFile, opts) {
                                const modulePath = resolve(sourcePath.replace(/\.js$/, ""));
                                return modulePath;
                            }
                        }],
                        "transform-es2015-modules-ui5"
                    ]
                });
            }
        };
    }

}
