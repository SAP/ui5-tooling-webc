const transpile = require("./transpile");

/**
 * Custom task to create the UI5 AMD-like bundles for used ES imports from node_modules.
 *
 * @param {object} parameters
 *
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies
 *      Reader to access resources of the project's dependencies
 * @param {@ui5/logger/Logger} parameters.log
 *      Logger instance for use in the custom task.
 *      This parameter is only available to custom task extensions
 *      defining Specification Version 3.0 and later.
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectName
 *      Name of the project currently being built
 * @param {string} parameters.options.projectNamespace
 *      Namespace of the project currently being built
 * @param {string} parameters.options.configuration
 *      Custom task configuration, as defined in the project's ui5.yaml
 * @param {string} parameters.options.taskName
 *      Name of the custom task.
 *      This parameter is only provided to custom task extensions
 *      defining Specification Version 3.0 and later.
 * @param {@ui5/builder.tasks.TaskUtil} parameters.taskUtil
 *      Specification Version-dependent interface to a TaskUtil instance.
 *      See the corresponding API reference for details:
 *      https://sap.github.io/ui5-tooling/v3/api/@ui5_project_build_helpers_TaskUtil.html
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace
 *      Reader/Writer to access and modify resources of the
 *      project currently being built
 * @returns {Promise<undefined>}
 *      Promise resolving once the task has finished
 */
module.exports = async function ({
    dependencies,
    log,
    options,
    taskUtil,
    workspace
}) {
    if (!taskUtil.isRootProject()) {
        log.info(`Skipping execution. Current project '${options.projectName}' is not the root project.`);
        return;
    }

    return transpile();
};
