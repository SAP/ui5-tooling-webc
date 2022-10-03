/* eslint-disable no-tabs */
const BuilderBase = require("./BuilderBase.js");
const getVersion = require("../utils/getVersion.js");
const beautifyJS = require("../utils/beautifyJS.js");

class LibraryFileBuilder extends BuilderBase {
	normalizeName(fullName) {
		const lastDot = fullName.lastIndexOf(".");
		const name = fullName.substr(lastDot + 1);
		return `${this.library}.${name}`;
	};

	generateLibrary() {
		const controls = this.libraryEntities.filter(entry => !!entry.tagname && !this.config?.noControl?.includes(entry.name));
		const types = this.libraryEntities.filter(entry => !entry.abstract && !entry.tagname && !this.config?.noControl?.includes(entry.name) && entry.kind !== "interface");
		const interfaces = this.libraryEntities.filter(entry => entry.kind === "interface");

		const typesString = types.map(type => `"${this.normalizeName(type.name)}"`).join(",\n");
		const interfacesString = interfaces.map(int => `"${this.normalizeName(int.name)}"`).join(",\n");
		const controlsString = controls.map(control => `"${this.normalizeName(control.name)}"`).join(",\n");

		let extensionsString = "";
		const designtimeConfig = this.config.designtime || {};
        const libraryPath = this.library.split(".").join("/");
		const changeHandlersStrings = [];
		for (const fullName in designtimeConfig) {
			if (!fullName.startsWith(this.library)) {
				continue;
			}

			const designtimeData = designtimeConfig[fullName]; // if string -> use dirctly, else build object

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
				"./thirdparty/Assets",
				"./library.config",
			], // library dependency
			function(commonLibrary) {

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
			var thisLib = sap.ui.getCore().initLibrary({
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
			const version = getVersion(this.config, this.normalizeName(int.name));
			template += `

			/**
			 * ${int.description}
			 *
			 * @name ${this.normalizeName(int.name)}
			 * @interface
			 * @${int.visibility}
			 * @since ${version}
			 * @experimental Since ${version} This API is experimental and might change significantly.
			 */`;
		});

		types.forEach(type => {
			const version = getVersion(this.config, `${this.library}.${type.basename}`);
			template += `

			/**
			 * ${type.description}
			 *
			 * @enum {string}
			 * @${type.visibility}
			 * @since ${version}
			 * @experimental Since ${version} This API is experimental and might change significantly.
			 */
			thisLib.${type.basename} = {`;

			type.properties.forEach(prop => {
				template += `

				/**
				 * ${prop.description || ""}
				 * @${prop.visibility}
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
}

module.exports = LibraryFileBuilder;
