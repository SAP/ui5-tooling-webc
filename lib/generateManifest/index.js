const fs = require("fs");
const Library = require("./models/Library");

/**
 *
 * @param {*} libraryName (f.e. @ui5/webcomponents-fiori)
 * @param {*} config ui5-tooling-webc custom configuration
 * @param {*} manifestFilesMap content of manifests (JSON)
 */
const generate = async (libraryName, config, manifestFilesMap) => {
    console.log(libraryName, manifestFilesMap)

    Library.libraries = new Map();
    manifestFilesMap.forEach((manifestFilePath, name) => {
        const manifest = JSON.parse(fs.readFileSync(manifestFilePath));
        const library = new Library(name, manifest);
        Library.libraries.set(name, library);
    });

    console.log(Library.libraries)

    // const manifestFiles = manifestFilesPaths.map(manifestFilePath => );
    // console.log(manifestFiles)
}

module.exports = generate;
