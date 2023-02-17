const path = require("path");
const merge = require("merge-deep");
const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;
const { getPackages } = require("./generalUtils");
const generate = require("./generate/index");
const getPackagePath = require("./getPackagePath");

const generateSourceFiles = async () => {
    const project = await normalizer.generateProjectTree({
        cwd: "./"
    });

    const dependencies = resourceFactory.createCollectionsForTree(project, {}).dependencies;
    const packages = getPackages(dependencies, project);

    let mergedGenerationConfig = {}; // the "generation" configuration for this library and all dependencies, merged
    const apiJSONFilesPaths = []; // list of all "api.json" files that must be read
    for (const packageName in packages) {
        const packageData = packages[packageName];
        if (packageData.inputPath.includes("node_modules")) {
            packageData.inputPath = "dist/"; // IMPORTANT: this will be removed once OpenUI5 is changed to use the new inputPath format
        }
        const generationConfig = packageData.generation;
        if (typeof generationConfig === "object") {
            mergedGenerationConfig = merge(mergedGenerationConfig, generationConfig || {});
            const packagePath = await getPackagePath(packageName);
            const apiJSONFilePath = path.join(packagePath, packageData.inputPath, "api.json");
            apiJSONFilesPaths.push(apiJSONFilePath);
        }
    }

    return generate(project.metadata.name, mergedGenerationConfig, apiJSONFilesPaths);
};

generateSourceFiles().then(() => {
    console.log(`Successfully generated source files`);
});
