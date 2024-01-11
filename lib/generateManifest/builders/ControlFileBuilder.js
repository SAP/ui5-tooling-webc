/* eslint-disable no-tabs */
const beautify = require('js-beautify').html;
const reserved = require('reserved-words');
const beautifyJS = require("../utils/beautifyJS.js");

const CUSTOM_CODE_START = `/* CUSTOM CODE START */`;
const CUSTOM_CODE_END = `/* CUSTOM CODE END */`;

const quoteReservedWord = str => {
	return reserved.check(str, 6) ? `"${str}"` : str;
};

class ControlFileBuilder {
	constructor(control, existingContent = "", allControls) {
		this.control = control;
		this.existingContent = existingContent;
        this.allControls = allControls;
	}

	formatDescription(description = "", isPrivate = false) {
		// remove things that don't make sense for OpenUI5
		description = description.split("\n").filter(line => {
			return !line.includes("ES6") && !line.includes("<code>import ") && !line.includes("Although this slot accepts HTML Elements");
		}).join("\n");

		description = description.split(` class="comment-api-title"`).join("");

		// replace tag names with namespaced UI5 controls
		description = description.replace(/<code>(ui5-.*?)<\/code>/g, (match, contents) => {
			const control = this.allControls.find(c => c.tag === contents);
			return `<code>${control ? control.name : contents}</code>`;
		});

		// replace links
		description = description.replace(/<ui5-link.*?href="(.*?)".*?>(.*?)<\/ui5-link>/g, "{@link $1 $2}");
		description = description.replace(/https:\/\/openui5.hana.ondemand.com\/test-resources\//g, "demo:");
		description = description.replace(/https:\/\/sdk.openui5.org\/test-resources\//g, "demo:");
		description = description.replace(/sapui5.hana.ondemand.com/g, "ui5.sap.com");

		// replace accessibleNameRef with ariaLabel (association)
		description = description.replace(/<code>accessibleNameRef<\/code>/g, "<code>ariaLabelledBy</code>");

		// put a new line before each <ul> and <br>
		description = description.replace(/<ul>/g, "\n<ul>")
			.replace(/<br>/g, "<br>\n");

		// private
		if (isPrivate) {
			description = `${description}\n@private`;
		}

		// beautify
		description = beautify(description);

		// remove &nbsp;
		description = description.replace(/&nbsp;/g, "");

		// finally put an asterisk before each line as this will be in a JS comment
		description = description.replace(/\n/g, "\n* ");

		return description;
	}

	getCustomCode() {
		let customCode = "";
		const startIndex = this.existingContent.indexOf(CUSTOM_CODE_START);
		const endIndex = this.existingContent.indexOf(CUSTOM_CODE_END);
		if (startIndex > -1 && endIndex > -1) {
			customCode = this.existingContent.substring(startIndex + CUSTOM_CODE_START.length, endIndex);
		}

		return customCode;
	}

	// The whole control
	generate() {
		// Required ones
		const requiredModules = [
			`"${this.control.baseClass.path}"`,
			`"./library"`
		];
		const requiredModulesNames = [
			`${this.control.baseClass.name}`,
			`library`
		];

		// Label enablement
		if (this.control.hasLabelEnablement) {
			requiredModules.push(`"sap/ui/core/LabelEnablement"`);
			requiredModulesNames.push(`LabelEnablement`);
		}

		// Enabled propagator
		if (this.control.supportsEnabled) {
			requiredModules.push(`"sap/ui/core/EnabledPropagator"`);
			requiredModulesNames.push(`EnabledPropagator`);
		}

		// Semantic form support
		if (this.control.hasSemanticFormSupport) {
			requiredModules.push(`"sap/ui/base/ManagedObjectObserver"`);
			requiredModulesNames.push(`ManagedObjectObserver`);
		}

		// Extra libraries
		[...this.control.libraries].forEach(lib => {
			requiredModules.push(`"${lib.split(".").join("/")}/library"`); // f.e. sap.ui.core -> "sap/ui/core/library"
			requiredModulesNames.push(lib.split(".").pop() + "Library"); // f.e. sap.ui.core -> coreLibrary
		});

		// Form "name" property support
		if (this.control.hasFormSupport && this.control.properties.find(prop => prop.name === "name")) {
			let formSupportModulePath = `"./thirdparty/features/InputElementsFormSupport"`;
			if (this.control.libraries.includes("sap.ui.webc.main")) {
				formSupportModulePath = `"sap/ui/webc/main/thirdparty/features/InputElementsFormSupport"`; // for components not in main, use the full path
			}
			requiredModules.push(formSupportModulePath);
		}

		// Other features
		if (this.control.features) {
			this.control.features.forEach(feature => {
				requiredModules.push(`"./thirdparty/features/${feature}"`);
			});
		}

		// The third-party component - required
		requiredModules.push(`"./thirdparty/${this.control.basename}"`);

		let template = `/*!
		 * \${copyright}
		 */

		// Provides control ${this.control.library}.${this.control.basename}.
		sap.ui.define([
			${requiredModules.join(",\n")}
		], function(${requiredModulesNames.join(", ")}) {
			"use strict";${this.enumsString}

			/**
			 * Constructor for a new <code>${this.control.basename}</code>.
			 *
			 * @param {string} [sId] ID for the new control, generated automatically if no ID is given
			 * @param {object} [mSettings] Initial settings for the new control
			 *
			 * @extends ${this.control.baseClass.fullName}
			 * @class
			 *
			 * ${this.formatDescription(this.control.description)}
			 *
			 * @author SAP SE
			 * @version \${version}
			 *
			 * @constructor
			 * @public
			 * @since ${this.control.version}
			 * @experimental Since ${this.control.version} This control is experimental and its API might change significantly.
			 * @alias ${this.control.name}${this.implementsInterfacesString}
			 */
			var ${this.control.basename} = ${this.control.baseClass.name}.extend("${this.control.name}", {
				metadata: {
					library: "${this.control.library}"${this.tagProperty}${this.interfacesString}${this.propertiesString}${this.aggregationsString}${this.associationsString}${this.eventsString}${this.methodsString}${this.gettersString}${this.designTimeString}
				}
			});${this.methodsJSDoc}${this.gettersJSDoc}\n`;

			if (this.control.hasLabelEnablement) {
				template += `\nLabelEnablement.enrich(${this.control.basename}.prototype);\n`;
			}

			if (this.control.supportsEnabled) {
				template += `\nEnabledPropagator.call(${this.control.basename}.prototype);\n`;
			}

			template += `\n${CUSTOM_CODE_START}${this.getCustomCode()}${CUSTOM_CODE_END}\n`;

			template += `\nreturn ${this.control.basename};
		});`;

		template = beautifyJS(template);

		return template + "\n";
	};

    get tagProperty() {
        if (!this.control.tagWithSuffix) {
            return "";
        }

        return `,tag: "${this.control.tagWithSuffix}"`;
    }

	get implementsInterfacesString() {
		const interfaces = this.control.interfaces;
		if (!interfaces.length) {
			return "";
		}

		return `\n* @implements ` + interfaces.join(", ");
	}

	get interfacesString() {
		const interfaces = this.control.interfaces;
		if (!interfaces.length) {
			return "";
		}

		return `,interfaces: [
			` + interfaces.map(int => `"${int}"`).join(",\n") + `
			]`;
	}

	get propertiesString() {
		const properties = this.control.properties;
		if (!properties.length) {
			return "";
		}

		let template = `,
		properties: {`;

		properties.forEach((prop) => {
			const type = prop.type;

			const defaultValue = prop.defaultValue;
			const defaultValueString = defaultValue
? `
			,defaultValue: ${defaultValue}`
: "";

			let mappingString;
			if (!prop.mapping) {
				mappingString = "";
			} else if (typeof prop.mapping === "string") {
				mappingString = `\n,mapping: "${prop.mapping}"`;
			} else {
				const formatterString = prop.mapping.formatter ? `,\nformatter: "${prop.mapping.formatter}"` : "";
				mappingString = `,
				mapping: {
					type: "${prop.mapping.type}",
					to: "${prop.mapping.to}"${formatterString}
				}`;
			}

			template += `

			/**
			* ${this.formatDescription(prop.description, prop.private)}
			*/
			${quoteReservedWord(prop.name)}: {
				type: "${type}"${defaultValueString}${mappingString}
			},`;
		});

		template += `}`;

		return template;
	};

	get enumsString() {
		const enums = this.control.enums;
		if (!enums.length) {
			return "";
		}

		return "\n\n" + enums.map(e => {
            const lastDot = e.lastIndexOf(".");
            const lib = e.substr(0, lastDot);
            const name = e.substr(lastDot + 1);
            let libraryVarName;

            if (lib === this.control.library) {
                libraryVarName = "library";
            } else {
                libraryVarName = lib.split(".").pop() + "Library"; // f.e. sap.ui.core -> coreLibrary, sap.ui.webc.main -> mainLibrary
            }

            return `var ${name} = ${libraryVarName}.${name};`
        }).join("\n");
	};

	get aggregationsString() {
		const aggregations = this.control.aggregations;
		if (!aggregations.length) {
			return "";
		}

		let template = "";

		// default aggregation
		const defaultAggregation = this.control.defaultAggregation;
		if (defaultAggregation) {
			template += `,\ndefaultAggregation: "${defaultAggregation}"`;
		}

		// list aggregations
		template += `,
		aggregations: {`;

		aggregations.forEach((agg) => {
			const slotString = agg.isDefault ? "" : `\n,slot: "${agg.name}"`;
			const aggMultiple = agg.multiple ? `true` : `false`;

			template += `

				/**
				* ${this.formatDescription(agg.description)}
				*/
				${quoteReservedWord(agg.name)}: {
					type: "${agg.type}",
					multiple: ${aggMultiple}${slotString}
				},`;
		});

		template += `}`;

		return template;
	};

	get associationsString() {
		const associations = this.control.associations;
		if (!associations.length) {
			return "";
		}

		let template = "";

		// list associations
		template += `,
		associations: {`;

		associations.forEach((assoc) => {
			const assocMultiple = assoc.multiple ? `true` : `false`;

			template += `

				/**
				* ${this.formatDescription(assoc.description)}
				*/
				${quoteReservedWord(assoc.name)}: {
					type: "${assoc.type}",
					multiple: ${assocMultiple},
					mapping: {
						type: "property",
						to: "${assoc.mappingName || assoc.name}",`;
						if (assoc.formatter) {
							template += `formatter: "${assoc.formatter}"`
						}
				template += `}
				},`;
		});

		template += `}`;

		return template;
	}

	get eventsString() {
		const events = this.control.events;
		if (!events.length) {
			return "";
		}

		let template = `,
		events: {`;

		events.forEach((event) => {
			template += `

			/**
			* ${this.formatDescription(event.description)}
			*/
			${quoteReservedWord(event.name)}: {`;

			if (event.allowPreventDefault) {
				template += `
				allowPreventDefault: true,`;
			}

			if (event.parameters) {
				template += `
				parameters: {`;

				event.parameters.forEach((param, index) => {
					template += `
					/**
					* ${this.formatDescription(param.description)}
					*/
					${param.name}: {type: "${param.type}"},
					`;
				});

				template += `}`;
			}

			template += `},`;
		});

		template += `}`;

		return template;
	};

	get methodsString() {
		const methods = this.control.methods;
		if (!methods.length) {
			return "";
		}

		const methodsString = methods.map(method => `"${method.name}"`).join(", ");

		return `,
		methods: [${methodsString}]`;
	};

	get gettersString() {
		const getters = this.control.getters;
		if (!getters.length) {
			return "";
		}

		const gettersString = getters.map(getter => `"${getter.name}"`).join(", ");

		return `,
		getters: [${gettersString}]`;
	}

	get designTimeString() {
		if (!this.control.designtime) {
			return "";
		}

		return `,
		designtime: "${this.control.designtime}"`;
	}

	get methodsJSDoc() {
		const methods = this.control.methods;
		if (!methods.length) {
			return "";
		}

		let result = "";

		methods.forEach(method => {
			result += `

		/**
		* ${this.formatDescription(method.description)}`;

			(method.parameters || []).forEach(param => {
				result += `
		* @param {${param.type}} ${param.name} ${param.description}`;
			});

			result += `
		* @public
		* @name ${this.control.name}#${method.name}
		* @function
		*/`;
		});

		return result;
	};

	get gettersJSDoc() {
		const getters = this.control.getters;
		if (!getters.length) {
			return "";
		}

		let result = "";

		getters.forEach(getter => {
			result += `

		/**
		* ${getter.description}
		* @public
		* @name ${this.control.name}#${getter.functionName}
		* @function
		*/`;
		});

		return result;
	};
}

module.exports = ControlFileBuilder;
