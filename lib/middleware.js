// const log = require("@ui5/logger").getLogger("server:custommiddleware:ui5-tooling-webc");
const { getReverseAliases, getAliases, getPackages } = require("./generalUtils");
const { getExternalFile, getExternalModuleData } = require("./babelUtils");
const normalizer = require("@ui5/project").normalizer;

/**
 * Custom middleware to enable the usage of UI5 Web Components projects in UI5
 *
 * @param {object} parameters Parameters
 * @param {object} parameters.resources Resource collections
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.all Reader or Collection to read resources of the
 *                                        root project and its dependencies
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.rootProject Reader or Collection to read resources of
 *                                        the project the server is started in
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.dependencies Reader or Collection to read resources of
 *                                        the projects dependencies
 * @param {object} parameters.middlewareUtil Specification version dependent interface to a
 *                                        [MiddlewareUtil]{@link module:@ui5/server.middleware.MiddlewareUtil} instance
 * @param {object} parameters.options Options
 * @param {string} [parameters.options.configuration] Custom server middleware configuration if given in ui5.yaml
 * @returns {function} Middleware function to use
 */
module.exports = async function serveWebComponents({
    resources,
    options,
    middlewareUtil
}) {
    // const verbose = options?.configuration?.verbose;
    let project; // for the OpenUI5 monorepo use case the try will fail and project will remain "undefined"
    try {
        project = await normalizer.generateProjectTree(); // needed for the project's own configuration (unless it's the monorepo use case)
    } catch (e) {}
    const packages = getPackages(resources.dependencies, project);
    const reverseAliases = getReverseAliases(packages); // used to map UI5 resource paths to the real files on the file system
    const aliases = getAliases(packages); // used to convert module paths to resource paths, understandable by the UI5 loader

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
