const fs = require("fs");
const path = require("path");
const ComponentsPackage = require("./models/ComponentsPackage");
const LibraryBuilder = require("./builders/LibraryFileBuilder");
const ControlFileBuilder = require("./builders/ControlFileBuilder");
const TestFilesBuilder = require("./builders/TestFilesBuilder");
const KitchenSinkFileBuilder = require("./builders/KitchenSinkFileBuilder");
const glob = require("glob");
const slash = require("slash");

/**
 *
 * @param {*} libraryName (f.e. @ui5/webcomponents-fiori)
 * @param {*} config ui5-tooling-webc custom configuration
 * @param {*} allPackages
 */
const generate = async (libraryName, config, allPackages) => {
    // Build the models for all packages
    ComponentsPackage.all = new Map();
    ComponentsPackage.tagToNameMap = new Map();
    ComponentsPackage.config = config;
    allPackages.forEach(data => {
        const packageName = data.packageName;

        if (!fs.existsSync(data.manifestFilePath)) {
            console.log(`Unable to read the ${data.manifestFilePath} file.\nPlease run: "npm run build" / "yarn build" for the web components package first.`);
            console.log(`Note: Only Custom Element Manifest is supported as of version 0.3 of @ui5/tooling-webc. Please use version 0.2.* for api.json`);
            process.exit();
        }

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
    const allControls = [...ComponentsPackage.all.values()].reduce((acc, p) => { return [...acc, ...p.controls]; }, []);
    const mainButton = allControls.find(control => control.name === "sap.ui.webc.main.Button");
    allControls.forEach(control => {
        control.mergedProperties = [];
        control.mergedAggregations = [];
        control.mergedEvents = [];
        control.mergedMethods = [];
        control.mergedGetters = [];
        control.baseClassesOrInterfaces = [];
        let current = control;
        while (current) {
            const baseClassName = current.baseClass.fullName;

            control.mergedProperties = [...control.mergedProperties, ...current.properties];
            control.mergedAggregations = [...control.mergedAggregations, ...current.aggregations];
            control.mergedEvents = [...control.mergedEvents, ...current.events];
            control.mergedMethods = [...control.mergedMethods, ...current.methods];
            control.mergedGetters = [...control.mergedGetters, ...current.getters];
            control.baseClassesOrInterfaces = [control.name, ...control.baseClassesOrInterfaces];
            current.interfaces.forEach(int => {
               if (!control.baseClassesOrInterfaces.includes(int)) {
                   control.baseClassesOrInterfaces.push(int);
               }
            });

            if (baseClassName === "sap.ui.core.webc.WebComponent") {
                current = undefined;
            } else {
                control.baseClassesOrInterfaces.push(baseClassName)
                current = allControls.find(control => control.name === baseClassName);
            }
        }
    });

    allControls.forEach(control => {
        control.mergedAggregations.forEach(aggregation => {
            if (aggregation.type === "sap.ui.core.Control") {
                aggregation.examples = [mainButton];
            } else {
                aggregation.examples = allControls.filter(ctr => {
                   // console.log(ctr.baseClassesOrInterfaces)
                    return ctr.tag && ctr.baseClassesOrInterfaces.includes(aggregation.type);
                });
                if (aggregation.examples.length === 0) console.log(aggregation.type)
            }
        });
    });

    // const controls = libraryPackages.reduce((acc, p) => { return [...acc, ...p.controls]; }, []);
    const controls = allControls.filter(control => control.library === libraryName);

    // Create output dirs
    const srcOutputDir = path.join("src/", libraryName.split(".").join(path.sep));
    fs.mkdirSync(srcOutputDir, { recursive: true });
    const testOutputDir = path.join("test/", libraryName.split(".").join(path.sep));
    fs.mkdirSync(testOutputDir, { recursive: true });
    const qunitOutputDir = path.join("test/", libraryName.split(".").join(path.sep), "qunit/");
    fs.mkdirSync(qunitOutputDir, { recursive: true });

    // Generate library.js
    const libraryBuilder = new LibraryBuilder(libraryName, libraryPackages);
    libraryBuilder.writeLibraryFiles();

    // Generate controls
    controls.forEach((control, index) => {
        const controlName = control.basename;
        console.log(`Control: ${index + 1}. ${controlName}`);

        // Control file
        const controlFilePath = path.join(srcOutputDir, `${controlName}.js`);
        const oldContent = fs.existsSync(controlFilePath) ? `${fs.readFileSync(controlFilePath)}` : "";
        const builder = new ControlFileBuilder(control, oldContent);
        const controlSource = builder.generate();
        fs.writeFileSync(controlFilePath, controlSource);

        // Test page
        if (control.tag && !config?.noControl?.includes(control.name) && !config?.noTestPage?.includes(control.name)) {
            const testPageFilePath = path.join(testOutputDir, `${controlName}.html`);
            console.log(testPageFilePath)
            const testBuilder = new TestFilesBuilder(control, !!mainButton);
            const testPageSource = testBuilder.generateTestPage();
            fs.writeFileSync(testPageFilePath, testPageSource);
        }

        // QUnit test
        if (control.tag && !config?.noControl?.includes(control.name) && !config?.noQUnit?.includes(control.name)) {
            const qUnitFilePath = path.join(qunitOutputDir, `${controlName}.qunit.js`);
            console.log(qUnitFilePath)
            const testBuilder = new TestFilesBuilder(control, !!mainButton);
            const qunitSource = testBuilder.generateQUnit();
            fs.writeFileSync(qUnitFilePath, qunitSource);
        }
    });

    // Generate kitchen sink
    console.log("Kitchen sink");
    const controlsWithTestPages = controls.filter(control => control.tag && !config?.noControl?.includes(control.name));
    const testPageSource = new KitchenSinkFileBuilder(controlsWithTestPages, !!mainButton).generateHTML();
    const kitchenSinkFilePath = path.join(testOutputDir, `kitchen.html`);
    fs.writeFileSync(kitchenSinkFilePath, testPageSource);

    // illustrations - only relevant for OpenUI5 stock libraries
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
            const libraryPath = libraryName.replace(/\./g, "/");
            const importPath = path.join(libraryPath, "thirdparty/illustrations", slash(illustrationPath)).replace(/\.js$/, "");

            const newFileContent = `/*!\n * $\{copyright}\n */\n\nsap.ui.define(["${importPath}"], function() {\n\t"use strict";\n});\n`;
            const newDir = path.dirname(newFilePath);
            if (!fs.existsSync(newDir)) {
                fs.mkdirSync(newDir, { recursive: true });
            }
            fs.writeFileSync(newFilePath, newFileContent);
        });
    };
    generateIllustrations();
}

module.exports = generate;
