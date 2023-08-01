const fs = require("fs").promises;
const path = require("path");
const { getAliases, getCyclicDependencies } = require("./generalUtils");
const { generateAll } = require("./babelUtils");

const transpile = async () => {
    const { graphFromPackageDependencies } = await import("@ui5/project/graph");

    const graph = await graphFromPackageDependencies({
        cwd: "./"
    }); // needed for the project's own configuration - always set as the prebuild is never run for the monorepo, but for individual libraries only

    const projects = [...graph.getProjects()]; // the project plus all dependencies (the project is at index 0)
    const customConfigurations = projects.map(project => project.getCustomConfiguration());

    const aliases = getAliases(customConfigurations);
    const cyclicDependencies = getCyclicDependencies(customConfigurations);

    const libraryPackages = customConfigurations[0]["ui5-tooling-webc"].packages;

    return Promise.all(Object.entries(libraryPackages).map(async pair => {
        const packageName = pair[0];
        const packageConfig = pair[1];
        const output = await generateAll(packageName, packageConfig, aliases, cyclicDependencies);
        if (output.length === 0) {
            console.log(`Warning: no files found for package: ${packageName}!\nPlease run: "npm run build" / "yarn build" for the web components package first.`);
            process.exit();
        }

        try {
            await fs.rm(packageConfig.outputPath, { recursive: true });
        } catch (e) {}
        return Promise.all(output.map(async module => {
            const outputFileName = path.join(packageConfig.outputPath, module.fileName);
            await fs.mkdir(path.dirname(outputFileName), { recursive: true });
            return fs.writeFile(outputFileName, module.code);
        }));
    }));
};

module.exports = transpile;
