const path = require("path");
const merge = require("merge-deep");
const generate = require("./generate/index");
const getPackagePath = require("./getPackagePath");

const generateSourceFiles = async () => {
    const { graphFromPackageDependencies } = await import("@ui5/project/graph");

    const graph = await graphFromPackageDependencies({
        cwd: "./"
    });

    const projects = [...graph.getProjects()]; // the project plus all dependencies (the project is at index 0)
    const currentProject = projects[0];
    const customConfigurations = projects.map(project => project.getCustomConfiguration());

    let mergedGenerationConfig = {}; // the "generation" configuration for this library and all dependencies, merged
    const apiJSONFilesPaths = []; // list of all "api.json" files that must be read

    for (const i in customConfigurations) {
        const customConfig = customConfigurations[i];
        if (customConfig && customConfig["ui5-tooling-webc"]) {
            const packages = customConfig["ui5-tooling-webc"].packages || {};
            for (const packageName in packages) {
                const packageData = packages[packageName];
                const generationConfig = packageData.generation;
                if (typeof generationConfig === "object") {
                    mergedGenerationConfig = merge(mergedGenerationConfig, generationConfig || {});
                    const packagePath = await getPackagePath(packageName);
                    const apiJSONFilePath = path.join(packagePath, packageData.inputPath, "api.json");
                    apiJSONFilesPaths.push(apiJSONFilePath);
                }
            }
        }
    }

    return generate(currentProject.getName(), mergedGenerationConfig, apiJSONFilesPaths);
};

generateSourceFiles().then(() => {
    console.log(`Successfully generated source files`);
});
