const fs = require("fs");
const ComponentsPackage = require("./models/ComponentsPackage");
const LibraryBuilder = require("./builders/LibraryFileBuilder");

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

    const libraryPackages = [...ComponentsPackage.all.values()].filter(p => p.namespace === libraryName);

    // Generate library.js
    const libraryBuilder = new LibraryBuilder(libraryName, libraryPackages);
    libraryBuilder.writeLibraryFiles();
}

module.exports = generate;
