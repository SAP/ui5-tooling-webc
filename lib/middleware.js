const { getReverseAliases, getAliases } = require("./generalUtils");
const { getExternalFile, getExternalModuleData } = require("./babelUtils");

/**
 * Custom middleware to enable the usage of UI5 Web Components projects in UI5
 *
 * @param {object} parameters Parameters
 * @param {@ui5/logger/Logger} parameters.log
 *      Logger instance for use in the custom middleware.
 *      This parameter is only provided to custom middleware
 *      extensions defining Specification Version 3.0 and later.
 * @param {@ui5/server.middleware.MiddlewareUtil} parameters.middlewareUtil
 *      Specification version-dependent interface to a
 *      MiddlewareUtil instance. See the corresponding API reference for details:
 *      https://sap.github.io/ui5-tooling/v3/api/@ui5_server_middleware_MiddlewareUtil.html
 * @param {object} parameters.options Options
 * @param {string} parameters.options.configuration
 *      Custom middleware configuration, as defined in the project's ui5.yaml
 * @param {string} parameters.options.middlewareName
 *      Name of the custom middleware.
 *      This parameter is only provided to custom middleware extensions
 *      defining Specification Version 3.0 and later
 * @param {object} parameters.resources Readers for accessing resources
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.all
 *      Reader to access resources of the root project and its dependencies
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.rootProject
 *      Reader to access resources of the root project
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.dependencies
 *      Reader to access resources of the project's dependencies.
 * @returns {function} Middleware function to use
 */
module.exports = async function serveWebComponents({ log, middlewareUtil, options, resources }) {
    const { graphFromPackageDependencies } = await import("@ui5/project/graph");

    // const verbose = options?.configuration?.verbose;
    let graph; // for the OpenUI5 monorepo use case the try will fail and project will remain "undefined"
    try {
        graph = await graphFromPackageDependencies({
            cwd: "./"
        }); // needed for the project's own configuration - always set as the prebuild is never run for the monorepo, but for individual libraries only
    } catch (e) {}

    const projects = [...graph.getProjects()]; // the project plus all dependencies (the project is at index 0)
    const customConfigurations = projects.map(project => project.getCustomConfiguration());
    const aliases = getAliases(customConfigurations);
    const reverseAliases = getReverseAliases(customConfigurations, !!options?.configuration?.processInternalLibraries);

    return async (req, res, next) => {
        // Determine if the required resource is an external file (not in the src/ directory, but rather part of a shimmed third-party web components project)
        const externalFile = await getExternalFile(req.path, reverseAliases);

        // If yes, find it in node_modules/, transpile it, and serve it.
        if (externalFile) {
            const { code, mime } = await getExternalModuleData(externalFile, aliases);
            res.setHeader("Content-Type", mime);
            res.send(code);
            res.end();
        // If no, then this is a true src/ file and just serve it normally
        } else {
            next();
        }
    }
}
