const fs = require("fs");
const ComponentsPackage = require("./models/ComponentsPackage");

/**
 *
 * @param {*} libraryName (f.e. @ui5/webcomponents-fiori)
 * @param {*} config ui5-tooling-webc custom configuration
 * @param {*} allPackages
 */
const generate = async (libraryName, config, allPackages) => {
    console.log(libraryName)

    // Build the models for all packages
    ComponentsPackage.all = new Map();
    allPackages.forEach(data => {
        const packageName = data.packageName;

        const settings = {
            manifest: JSON.parse(fs.readFileSync(data.manifestFilePath)),
            namespace: data.projectName
        }
        const p = new ComponentsPackage(packageName, settings);
        ComponentsPackage.all.set(packageName, p);
    });

    // Generate the items (controls, etc.) for the packages, belonging to the library
    ComponentsPackage.all.forEach(p => {
       if (p.namespace === libraryName) {
           console.log("Generating controls for: ", p.namespace);
       }
    });
}

module.exports = generate;
