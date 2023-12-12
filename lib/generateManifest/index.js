const fs = require("fs");
const ComponentsPackage = require("./models/ComponentsPackage");
const LibraryBuilder = require("./builders/LibraryFileBuilder");
const path = require("path");

/**
 *
 * @param {*} libraryName (f.e. @ui5/webcomponents-fiori)
 * @param {*} config ui5-tooling-webc custom configuration
 * @param {*} allPackages
 */
const generate = async (libraryName, config, allPackages) => {
    // Build the models for all packages
    ComponentsPackage.all = new Map();
    ComponentsPackage.config = config;
    allPackages.forEach(data => {
        const packageName = data.packageName;

        const settings = {
            manifest: JSON.parse(fs.readFileSync(data.manifestFilePath)),
            namespace: data.projectName
        }
        const p = new ComponentsPackage(packageName, settings);
        ComponentsPackage.all.set(packageName, p);
    });

    ComponentsPackage.all.forEach(p => {
        p.generate();
    });

    const libraryPackages = [...ComponentsPackage.all.values()].filter(p => p.namespace === libraryName);

    // Create output dir
    const srcOutputDir = path.join("src/", libraryName.split(".").join(path.sep));
    fs.mkdirSync(srcOutputDir, { recursive: true });

    // Generate library.js
    const libraryBuilder = new LibraryBuilder(libraryName, libraryPackages);
    libraryBuilder.writeLibraryFiles();

    // Generate controls
    const controls = libraryPackages.reduce((acc, p) => { return [...acc, ...p.controls]; }, []);

    controls.forEach(c => {
        console.log(c.name, c.aggregations)
    })
}

module.exports = generate;
