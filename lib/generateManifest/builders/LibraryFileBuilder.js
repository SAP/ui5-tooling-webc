/* eslint-disable no-tabs */
const beautifyJS = require("../utils/beautifyJS.js");
const path = require("path");
const fs = require("fs");

class LibraryFileBuilder {
    constructor(library, packages) {
        this.library = library;
        this.packages = packages;
    }

	generateLibrary() {
		const controls = this.packages.reduce((acc, p) => { return [...acc, ...p.controls]; }, []);
		const types = this.packages.reduce((acc, p) => { return [...acc, ...p.enums]; }, []);
		const interfaces = this.packages.reduce((acc, p) => { return [...acc, ...p.interfaces]; }, []);
		const designTimeConfig = this.packages.reduce((acc, p) => { return {...acc, ...p.designTimeData}; }, {});

		const typesString = types.map(type => `"${type.name}"`).join(",\n");
		const interfacesString = interfaces.map(int => `"${int.name}"`).join(",\n");
		const controlsString = controls.map(control => `"${control.name}"`).join(",\n");

		let extensionsString = "";
        const libraryPath = this.library.split(".").join("/");
		const changeHandlersStrings = [];
		for (const fullName in designTimeConfig) {
			if (!fullName.startsWith(this.library)) {
				continue;
			}

			const designtimeData = designTimeConfig[fullName]; // if string -> use dirctly, else build object

			if (designtimeData === null) {
				continue; // if undefined, only set the string in the control file, nothing for the library
			}

			let stringForControl;
			if (typeof designtimeData === "string") {
				stringForControl = `"${fullName}": "${designtimeData}"`;
			} else {
				stringForControl = `"${fullName}": {`;
				if (designtimeData.includes("hide")) {
					stringForControl += `"hideControl": "default",`;
				}
				if (designtimeData.includes("unhide")) {
					stringForControl += `"unhideControl": "default",`;
				}
				if (designtimeData.includes("move")) {
					stringForControl += `"moveControls": "default"`;
				}
				stringForControl += `}`;
			}
			changeHandlersStrings.push(stringForControl);
		}
		if (changeHandlersStrings.length) {
			extensionsString = `
				flChangeHandlers: {
					${changeHandlersStrings.join(",\n")}
				}
			`;
		}

		let template = `
		/*!
		 * \${copyright}
		 */

		/**
		 * Initialization Code and shared classes of library ${this.library}
		 */
		sap.ui.define([
				"sap/ui/webc/common/library",
				"sap/ui/core/Lib",
				"./thirdparty/Assets",
				"./library.config",
			], // library dependency
			function(commonLibrary, Library) {

			"use strict";

			/**
			 * SAPUI5 library with controls based on UI5 Web Components
			 *
			 * @namespace
			 * @alias ${this.library}
			 * @author SAP SE
			 * @version \${version}
			 * @public
			 * @since 1.92.0
			 * @experimental Since 1.92.0 This API is experimental and might change significantly.
			 */
			var thisLib = Library.init({
				name : "${this.library}",
				version: "\${version}",
				dependencies : ["sap.ui.core", "sap.ui.webc.common"],
				noLibraryCSS: true,
				designtime: "${libraryPath}/designtime/library.designtime",
				interfaces: [
					${interfacesString}
				],
				types: [
					${typesString}
				],
				controls: [
					${controlsString}
				],
				elements: [
				],
				extensions: {${extensionsString}}
			});`;

		interfaces.forEach(int => {
			template += `

			/**
			 * ${int.description}
			 *
			 * @name ${int.name}
			 * @interface
			 * @public
			 * @since ${int.version}
			 * @experimental Since ${int.version} This API is experimental and might change significantly.
			 */`;
		});

		types.forEach(type => {
			template += `

			/**
			 * ${type.description}
			 *
			 * @enum {string}
			 * @public
			 * @since ${type.version}
			 * @experimental Since ${type.version} This API is experimental and might change significantly.
			 */
			thisLib.${type.basename} = {`;

			type.properties.forEach(prop => {
				template += `

				/**
				 * ${prop.description}
				 * @public
				 */
				${prop.name}: "${prop.name}",`;
				});

				template += `
				};
				`;
		});

		template += `
		return thisLib;

		});
		`;

		template = beautifyJS(template);

		return template;
	}

	generateLibraryConfig() {
		return `sap.ui.define([], function() {\n\t"use strict";\n});\n`;
	}

    writeLibraryFiles() {
        const srcOutputDir = path.join("src/", this.library.split(".").join(path.sep));

        // library.js
        const libraryFilePath = path.join(srcOutputDir, `library.js`);
        fs.writeFileSync(libraryFilePath, this.generateLibrary());

        // library.config.js
        const libraryConfigFilePath = path.join(srcOutputDir, `library.config.js`);
        if (!fs.existsSync(libraryConfigFilePath)) {
            fs.writeFileSync(libraryConfigFilePath, this.generateLibraryConfig());
        }
    }
}

module.exports = LibraryFileBuilder;
