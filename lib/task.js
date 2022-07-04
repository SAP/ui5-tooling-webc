const log = require("@ui5/logger").getLogger("builder:customtask:ui5-tooling-webc");

const {
    createHelper
} = require("./util");

/**
 * Custom task to create the UI5 AMD-like bundles for used ES imports from node_modules.
 *
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {object} parameters.taskUtil Specification Version dependent interface to a
 *                [TaskUtil]{@link module:@ui5/builder.tasks.TaskUtil} instance
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @param {string} [parameters.options.projectNamespace] Project namespace if available
 * @param {string} [parameters.options.configuration] Task configuration if given in ui5.yaml
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function ({
    workspace,
    dependencies,
    taskUtil,
    options
}) {
    if (!taskUtil.isRootProject()) {
        log.info(`Skipping execution. Current project '${options.projectName}' is not the root project.`);
        return;
    }

    // const verbose = options?.configuration?.verbose;

    const helper = createHelper(dependencies);

    const allResources = await helper.byGlob("/**");

    await Promise.all(allResources.map(async (resource) => {
        const path = resource.getPath();
        // we only transpile JS sources
        if (path.endsWith(".js")) {
            log.info(`Transpile ${path}`);
            const transpiledCode = await helper.transpile(resource);
            resource.setString(transpiledCode.code);
        }
        return workspace.write(resource);
    }));
};
