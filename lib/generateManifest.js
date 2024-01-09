const fs = require("fs");
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
    const allPackages = [];

    for (const i in projects) {
        const projectName = projects[i].getName(); // f.e. sap.ui.webc.main
        const projectCustomConfiguration = projects[i].getCustomConfiguration();

        if (projectCustomConfiguration && projectCustomConfiguration["ui5-tooling-webc"]) {
            const packages = projectCustomConfiguration["ui5-tooling-webc"].packages || {}; // f.e. @ui5/webcomponents
            for (const packageName in packages) {
                const packageData = packages[packageName];

                // Merge generation config, if any
                const generationConfig = packageData.generation;
                if (typeof generationConfig === "object") {
                    mergedGenerationConfig = merge(mergedGenerationConfig, generationConfig || {});
                }

                // Manifests
                let packagePath;
                try {
                    packagePath = await getPackagePath(packageName);
                } catch (e) {
                    continue; // package not found
                }

                const manifestFilePath = path.join(packagePath, packageData.inputPath, "custom-elements-internal.json");
                if (!fs.existsSync(manifestFilePath)) {
                    continue; // no custom elements manifest for this package (f.e. icons, theming, etc.)
                }
                allPackages.unshift({
                    projectName,
                    packageName,
                    manifestFilePath
                }); // unshift instead of push so that dependencies go first in allPackages
            }
        }
    }

    return generate(currentProject.getName(), mergedGenerationConfig, allPackages);
};

generateSourceFiles().then(() => {
    console.log(`Successfully generated source files`);
});
