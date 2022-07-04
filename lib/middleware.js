// const log = require("@ui5/logger").getLogger("server:custommiddleware:ui5-tooling-webc");

const {
    createHelper
} = require("./util");

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
module.exports = function serveWebComponents({
    resources,
    options,
    middlewareUtil
}) {
    // const verbose = options?.configuration?.verbose;

    const helper = createHelper(resources.dependencies);

    return async (req, res, next) => {
        const resource = await helper.byPath(req.path);
        if (resource) {
            const transpiledCode = await helper.transpile(resource);

            // determine charset and content-type
            const {
                contentType
                // charset
            } = middlewareUtil.getMimeInfo(req.path);
            res.setHeader("Content-Type", contentType);

            res.send(transpiledCode.code);

            res.end();

            // log.verbose(`Created bundle for ${req.path}`);

            // log.info(`Bundling took ${(Date.now() - time)} millis`);
        } else {
            next();
        }
    }
}
