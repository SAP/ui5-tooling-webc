const fs = require("fs");
const path = require("path");
const glob = require("glob");
const slash = require("slash");

// Builders
const ControlFileBuilder = require("./builders/ControlFileBuilder.js");
const TestFilesBuilder = require("./builders/TestFilesBuilder.js");
const KitchenSinkFileBuilder = require("./builders/KitchenSinkFileBuilder.js");
const LibraryFileBuilder = require("./builders/LibraryFileBuilder.js");

// API entities (controls, types, interfaces, etc...)
const getAllEntities = require("./utils/getAllEntities.js");

const generate = async (library, config, apiFilesPaths) => {
    const srcOutputDir = path.join("src/", library.split(".").join(path.sep));
    const testOutputDir = path.join("test/", library.split(".").join(path.sep));

    const generateLibrary = allEntities => {
        console.log(`Generating: library.js`);

        const builder = new LibraryFileBuilder(config, library, allEntities);

        // library.js
        const libraryFilePath = path.join(srcOutputDir, `library.js`);
        fs.writeFileSync(libraryFilePath, builder.generateLibrary());

        // library.config.js
        const libraryConfigFilePath = path.join(srcOutputDir, `library.config.js`);
        if (!fs.existsSync(libraryConfigFilePath)) {
            fs.writeFileSync(libraryConfigFilePath, builder.generateLibraryConfig());
        }
    };

    const generateControl = (entry, allEntities, index) => {
        const controlName = entry.basename;
        const controlFilePath = path.join(srcOutputDir, `${controlName}.js`);
        let oldContent = "";

        console.log(`Control: ${index + 1}. ${controlName}`);

        if (fs.existsSync(controlFilePath)) {
            oldContent = `${fs.readFileSync(controlFilePath)}`;
        }

        const builder = new ControlFileBuilder(config, library, entry, allEntities, config.suffix || "", oldContent);
        const controlSource = builder.generate();

        fs.writeFileSync(controlFilePath, controlSource);
    };

    const generateTestPageAndQUnit = (entry, allEntities, index) => {
        const controlName = entry.basename;

        console.log(`Test page: ${index + 1}. ${controlName}`);

        const builder = new TestFilesBuilder(config, library, entry, allEntities);

        // Test page
        if (!config.customTestsuite?.includes(entry.name)) {
            const testPageSource = builder.generateTestPage();
            const testPageFilePath = path.join(testOutputDir, `${controlName}.html`);
            fs.writeFileSync(testPageFilePath, testPageSource);
        }

        // QUnit page
        if (!config.customQUnit?.includes(entry.name)) {
            const qunitPageSource = builder.generateQUnit();
            const qunitFilePath = path.join(testOutputDir, `qunit/${controlName}.qunit.js`);
            fs.writeFileSync(qunitFilePath, qunitPageSource);
        }
    };

    const generateKitchenSink = (library, allEntities) => {
        console.log("Kitchen sink");

        const testPageSource = new KitchenSinkFileBuilder(config, library, allEntities).generateHTML();
        const kitchenSinkFilePath = path.join(testOutputDir, `kitchen.html`);
        fs.writeFileSync(kitchenSinkFilePath, testPageSource);
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

            const newFileContent = `sap.ui.define(["${importPath}"], function() {\n\t"use strict";\n});\n`;
            const newDir = path.dirname(newFilePath);
            if (!fs.existsSync(newDir)) {
                fs.mkdirSync(newDir, { recursive: true });
            }
            fs.writeFileSync(newFilePath, newFileContent);
        });
    };

    // build the API
    const apiFiles = apiFilesPaths.map(apiFilePath => `${fs.readFileSync(apiFilePath)}`);
    const allEntities = getAllEntities(apiFiles, config.jsDocNamespaces);

    // generate the library file
    fs.mkdirSync(srcOutputDir, { recursive: true });
    generateLibrary(allEntities);

    // generate all controls
    const libraryEntities = new LibraryFileBuilder(config, library, allEntities).libraryEntities;
    const entryPointControls = libraryEntities.filter(entry => config.entryPoints.includes(entry.name));

    libraryEntities.filter(entry => !!entry.tagname && !config.excludeList.includes(entry.name)).forEach((entry, index) => {
        generateControl(entry, allEntities, index);
    });

    // generate all test pages and qunits
    fs.mkdirSync(testOutputDir, { recursive: true });
    fs.mkdirSync(path.join(testOutputDir, "qunit/"), { recursive: true });
    entryPointControls.forEach((entry, index) => {
        generateTestPageAndQUnit(entry, allEntities, index);
    });

    // kitchen sink test page (all controls on one test page)
    generateKitchenSink(library, allEntities);

    // illustrations - only relevant for OpenUI5 stock libraries
    generateIllustrations();
}

module.exports = generate;
