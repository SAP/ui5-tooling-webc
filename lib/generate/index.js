const fs = require("fs");
const path = require("path");
const glob = require("glob");
const slash = require("slash");

const ControlTemplateBuilder = require("./builders/ControlTemplateBuilder.js");
const TestPageTemplateBuilder = require("./builders/TestPageTemplateBuilder.js");
const KitchenSinkTemplateBuilder = require("./builders/KitchenSinkTemplateBuilder.js");
const LibraryTemplateBuilder = require("./builders/LibraryTemplateBuilder.js");
const getAllEntities = require("./utils/getAllEntities.js");

const generate = async (library, config, apiPaths, packagesForThisLibrary) => {
    const srcOutputDir = path.join("src/", library.split(".").join(path.sep));
    const testOutputDir = path.join("test/", library.split(".").join(path.sep));

    const generateLibrary = allEntities => {
        console.log(`Generating: library.js`);

        const builder = new LibraryTemplateBuilder(config, library, allEntities, packagesForThisLibrary);
        const librarySource = builder.generate();

        const outputFileName = path.join(srcOutputDir, `library.js`);
        fs.writeFileSync(outputFileName, librarySource);

        // library.config.js
        const libraryConfigFileName = path.join(srcOutputDir, `library.config.js`);
        if (!fs.existsSync(libraryConfigFileName)) {
            fs.writeFileSync(libraryConfigFileName, `sap.ui.define([], function() {
	"use strict";
});
`);
        }
    };

    const generateControl = (entry, allEntities, index) => {
        const name = entry.basename;
        const outputFileName = path.join(srcOutputDir, `${name}.js`);
        let oldContent = "";

        console.log(`Control: ${index+1}. ${name}`);

        if (fs.existsSync(outputFileName)) {
            oldContent = `${fs.readFileSync(outputFileName)}`;
        }

        const builder = new ControlTemplateBuilder(config, library, entry, allEntities, config.suffix || "", oldContent);
        const controlSource = builder.generate();

        fs.writeFileSync(outputFileName, controlSource);
    };

    const generateTestPageAndQUnit = (entry, allEntities, index) => {
        const name = entry.basename;

        console.log(`Test page: ${index+1}. ${name}`);

        const builder = new TestPageTemplateBuilder(config, library, entry, allEntities);

        // Test page
        if (!config.customTestsuite.includes(entry.name)) {
            let testPageSource = builder.generateHTML();
            const testPageOutputFileName = path.join(testOutputDir, `${name}.html`);
            fs.writeFileSync(testPageOutputFileName, testPageSource);
        }

        // QUnit page
        if (!(config.customQUnit || []).includes(entry.name)) {
            let qunitPageSource = builder.generateQUnit();
            const qunitOutputFileName = path.join(testOutputDir, `qunit/${name}.qunit.js`);
            fs.writeFileSync(qunitOutputFileName, qunitPageSource);
        }
    };

    const generateKitchenSink = (library, allEntities) => {
        console.log("Kitchen sink");

        const testPageSource = new KitchenSinkTemplateBuilder(config, library, allEntities).generateHTML();
        const outputFileName = path.join(testOutputDir, `kitchen.html`);
        fs.writeFileSync(outputFileName, testPageSource);
    };

    const generateIllustrations = () => {
        const illustrationsDir = path.join(srcOutputDir, "thirdparty/illustrations/");
        if (!fs.existsSync(illustrationsDir)) {
            return; // no illustrations for this package
        }

        glob.sync(path.join(illustrationsDir, "**/*.js")).forEach(illustration => {
            if (illustration.includes("sapIllus-") || illustration.includes("tnt-")) {
                return; // skip parts of illustrations, we want proxies only for the full illustrations
            }

            const illustrationPath = illustration.split(illustrationsDir)[1];
            const newFilePath = path.join(srcOutputDir, "illustrations/", illustrationPath);
            const libraryPath = library.replace(/\./g, "/");
            const importPath = path.join(libraryPath, "thirdparty/illustrations", slash(illustrationPath)).replace(/\.js$/, "");

            const newFileContent = `sap.ui.define(["${importPath}"], function() {
	"use strict";
});
`;
            const newDir = path.dirname(newFilePath);
            if (!fs.existsSync(newDir)) {
                fs.mkdirSync(newDir, {recursive: true});
            }
            fs.writeFileSync(newFilePath, newFileContent);
        });
    };

    // build the API
    const apiFiles = apiPaths.map(apiFilePath => `${fs.readFileSync(apiFilePath)}`);
    let allEntities = getAllEntities(apiFiles, config);

    // generate the library file
    generateLibrary(allEntities);

    // generate all controls
    const libraryEntities = new LibraryTemplateBuilder(config, library, allEntities).libraryEntities;
    const entryPointControls = libraryEntities.filter(entry => config.entryPoints.includes(entry.name));

    libraryEntities.filter(entry => !!entry.tagname && !config.excludeList.includes(entry.name)).forEach((entry, index) => {
        generateControl(entry, allEntities, index);
    });

    // generate all test pages and qunits
    entryPointControls.forEach((entry, index) => {
        generateTestPageAndQUnit(entry, allEntities, index);
    });

    // kitchen sink test page
    generateKitchenSink(library, allEntities);

    // illustrations
    generateIllustrations();

}

module.exports = generate;
