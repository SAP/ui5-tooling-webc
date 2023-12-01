const path = require("path");
const merge = require("merge-deep");
const generate = require("./generateManifest/index");
const getPackagePath = require("./getPackagePath");

const generateSourceFiles = async () => {
    const { graphFromPackageDependencies } = await import("@ui5/project/graph");

    const graph = await graphFromPackageDependencies({
        cwd: "./"
    });

    const projects = [...graph.getProjects()]; // the project plus all dependencies (the project is at index 0)
    const currentProject = projects[0];

    let mergedGenerationConfig = {}; // the "generation" configuration for this library and all dependencies, merged
    const manifestFilesMap = new Map();

    for (const i in projects) {
        const customConfig = projects[i].getCustomConfiguration();
        if (customConfig && customConfig["ui5-tooling-webc"]) {
            console.log(customConfig)
            const packages = customConfig["ui5-tooling-webc"].packages || {};
            console.log(packages)
            for (const packageName in packages) {
                const packageData = packages[packageName];
                packageData.projectName = projects[i].getName();
                const generationConfig = packageData.generation;
                console.log("FF", generationConfig)
                if (typeof generationConfig === "object") {
                    mergedGenerationConfig = merge(mergedGenerationConfig, generationConfig || {});
                    const packagePath = await getPackagePath(packageName);
                    const manifestFilePath = path.join(packagePath, packageData.inputPath, "custom-elements.json");
                    console.log("FFFF", manifestFilePath)
                    manifestFilesMap.set(packageName, manifestFilePath);
                }
            }
        }
    }

    return generate(currentProject.getName(), mergedGenerationConfig, manifestFilesMap);
};

generateSourceFiles().then(() => {
    console.log(`GGGGSuccessfully generated source files`);
});
