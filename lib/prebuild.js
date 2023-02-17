const fs = require("fs").promises;
const path = require("path");
const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;
const { getAliases, getPackages } = require("./generalUtils");
const { generateAll } = require("./babelUtils");
// const copyDir = require("./copyDir");

const generate = async () => {
    // await copyDir("src/", "src-gen/");
    const project = await normalizer.generateProjectTree(); // needed for the project's own configuration - always set as the prebuild is never run for the monorepo, but for individual libraries only
    const dependencies = resourceFactory.createCollectionsForTree(project, {}).dependencies;
    const packages = getPackages(dependencies, project);
    const aliases = getAliases(packages);

    const libraryPackages = project.customConfiguration["ui5-tooling-webc"].packages;

    return Promise.all(Object.entries(libraryPackages).map(async pair => {
        const packageName = pair[0];
        const packageConfig = pair[1];
        const output = await generateAll(packageName, packageConfig, aliases);

        return Promise.all(output.map(async module => {
            const outputFileName = path.join(packageConfig.outputPath, module.fileName);
            await fs.mkdir(path.dirname(outputFileName), { recursive: true });
            return fs.writeFile(outputFileName, module.code);
        }));
    }));
};

generate().then(() => {
    console.log(`Prebuild successful.`);
});
