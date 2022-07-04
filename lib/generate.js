const path = require("path");
const merge = require("merge-deep");
const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;
const { getPackages } = require("./generalUtils");
const generate = require("./generate/index");

const generateSourceFiles = async () => {
    const project = await normalizer.generateProjectTree({
        cwd: "./"
    });

    const dependencies = resourceFactory.createCollectionsForTree(project, {}).dependencies;
    const packages = getPackages(dependencies, project);

    let config = {};
    const apiPaths = [];
    for (const packageName in packages) {
        const packageData = packages[packageName];
        const generationConfig = packageData.generation;
        if (generationConfig) {
            config = merge(config, generationConfig);
            apiPaths.push(path.join(packageData.inputPath, "api.json"));
        }
    }

    const packagesForThisLibrary = Object.keys(project.customConfiguration["ui5-tooling-webc"].packages);

    return generate(project.metadata.name, config, apiPaths, packagesForThisLibrary);
};

generateSourceFiles().then(() => {
    console.log(`Successfully generated source files`);
});
