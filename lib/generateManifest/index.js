const fs = require("fs");
const path = require("path");
const ComponentsPackage = require("./models/ComponentsPackage");
const LibraryBuilder = require("./builders/LibraryFileBuilder");
const ControlFileBuilder = require("./builders/ControlFileBuilder");
const TestFilesBuilder = require("./builders/TestFilesBuilder");

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
                aggregation.examples = [ mainButton ];
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
            const qUnitFilePath = path.join(qunitOutputDir,`${controlName}.qunit.js`);
            console.log(qUnitFilePath)
            const testBuilder = new TestFilesBuilder(control, !!mainButton);
            const qunitSource = testBuilder.generateQUnit();
            fs.writeFileSync(qUnitFilePath, qunitSource);
        }
    })
}

module.exports = generate;
