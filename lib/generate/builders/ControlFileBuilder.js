/* eslint-disable no-tabs */
const beautify = require('js-beautify').html;
const reserved = require('reserved-words');
const getVersion = require("../utils/getVersion.js");
const beautifyJS = require("../utils/beautifyJS.js");

const ControlModel = require("./ControlModel.js");
const BuilderBase = require("./BuilderBase.js");

const CUSTOM_CODE_START = `/* CUSTOM CODE START */`;
const CUSTOM_CODE_END = `/* CUSTOM CODE END */`;

const quoteReservedWord = str => {
	return reserved.check(str, 6) ? `"${str}"` : str;
};

class ControlFileBuilder extends BuilderBase {
	constructor(config, library, control, allEntities, tagSuffix = undefined, existingContent = "") {
		super(config, library, allEntities);
		this.control = control;
		this.fullName = control.name;
		this.controlName = control.basename;
		this.tagSuffix = tagSuffix;
		this.existingContent = existingContent;
		this.model = new ControlModel(config, library, control, this.allEntities);
	}

	formatDescription(description = "", isPrivate = false) {
		// remove things that don't make sense for OpenUI5
		description = description.split("\n").filter(line => {
			return !line.includes("ES6") && !line.includes("<code>import ") && !line.includes("Although this slot accepts HTML Elements");
		}).join("\n");

		description = description.split(` class="comment-api-title"`).join("");

		// replace tag names with namespaced UI5 controls
		description = description.replace(/<code>(ui5-.*?)<\/code>/g, (match, contents) => {
			const control = this.allEntities.find(entity => entity.tagname === contents);
			return `<code>${control ? control.name : contents}</code>`;
		});

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
		const version = getVersion(this.config, `${this.library}.${this.controlName}`);

		// Required ones
		const requiredModules = [
			`"sap/ui/webc/common/WebComponent"`,
			`"./library"`
		];
		const requiredModulesNames = [
			`WebComponent`,
			`library`
		];

		// Label enablement
		if (this.config.includeLabelEnablement?.includes(this.fullName)) {
			requiredModules.push(`"sap/ui/core/LabelEnablement"`);
			requiredModulesNames.push(`LabelEnablement`);
		}

		// Enabled propagator
		if (this.model.supportsEnabled()) {
			requiredModules.push(`"sap/ui/core/EnabledPropagator"`);
			requiredModulesNames.push(`EnabledPropagator`);
		}

		// Semantic form support
		if (this.config.includeSemanticFormSupport?.includes(this.fullName)) {
			requiredModules.push(`"sap/ui/base/ManagedObjectObserver"`);
			requiredModulesNames.push(`ManagedObjectObserver`);
		}

		// Extra libraries
		[...this.model.extraLibraries].forEach(lib => {
			requiredModules.push(`"${lib.split(".").join("/")}/library"`); // f.e. sap.ui.core -> "sap/ui/core/library"
			requiredModulesNames.push(lib.split(".").pop() + "Library"); // f.e. sap.ui.core -> coreLibrary
		});

		// The third-party component - required
		requiredModules.push(`"./thirdparty/${this.controlName}"`);

		// Form "name" property support
		if (this.model.hasFormNameProperty()) {
			let formSupportModulePath = `"./thirdparty/features/InputElementsFormSupport"`;
			if (this.model.extraLibraries.has("sap.ui.webc.main")) {
				formSupportModulePath = `"sap/ui/webc/main/thirdparty/features/InputElementsFormSupport"`; // for components not in main, use the full path
			}

			requiredModules.push(formSupportModulePath);
		}

		// Other features
		const features = (this.config.features || {})[this.fullName];
		if (features) {
			features.forEach(feature => {
				requiredModules.push(`"./thirdparty/features/${feature}"`);
			});
		}

		let template = `/*!
		 * \${copyright}
		 */

		// Provides control ${this.library}.${this.controlName}.
		sap.ui.define([
			${requiredModules.join(",\n")}
		], function(${requiredModulesNames.join(", ")}) {
			"use strict";${this.enumsString}

			/**
			 * Constructor for a new <code>${this.controlName}</code>.
			 *
			 * @param {string} [sId] ID for the new control, generated automatically if no ID is given
			 * @param {object} [mSettings] Initial settings for the new control
			 *
			 * @extends sap.ui.webc.common.WebComponent
			 * @class
			 *
			 * ${this.formatDescription(this.control.description)}
			 *
			 * @author SAP SE
			 * @version \${version}
			 *
			 * @constructor
			 * @public
			 * @since ${version}
			 * @experimental Since ${version} This control is experimental and its API might change significantly.
			 * @alias ${this.library}.${this.controlName}${this.implementsInterfacesString}
			 */
			var ${this.controlName} = WebComponent.extend("${this.library}.${this.controlName}", {
				metadata: {
					library: "${this.library}",
					tag: "${this.control.tagname}${this.tagSuffix}"
					${this.interfacesString}${this.propertiesString}${this.aggregationsString}${this.associationsString}${this.eventsString}${this.methodsString}${this.gettersString}${this.designTimeString}
				}
			});${this.methodsJSDoc}${this.gettersJSDoc}\n`;

			if (this.config.includeLabelEnablement?.includes(this.fullName)) {
				template += `\nLabelEnablement.enrich(${this.controlName}.prototype);\n`;
			}

			if (this.model.supportsEnabled()) {
				template += `\nEnabledPropagator.call(${this.controlName}.prototype);\n`;
			}

			template += `\n${CUSTOM_CODE_START}${this.getCustomCode()}${CUSTOM_CODE_END}\n`;

			template += `\nreturn ${this.controlName};
		});`;

		template = beautifyJS(template);

		return template;
	};

	get implementsInterfacesString() {
		const interfaces = this.model.getInterfaces();
		if (!interfaces.length) {
			return "";
		}

		return `\n* @implements ` + interfaces.join(", ");
	}

	get interfacesString() {
		const interfaces = this.model.getInterfaces();
		if (!interfaces.length) {
			return "";
		}

		return `,interfaces: [
			` + interfaces.map(int => `"${int}"`).join(",\n") + `
			]`;
	}

	get propertiesString() {
		const properties = this.model.getProperties();
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

			// Extra markup for private properties
			const visibilityString = prop.private ? `\n,visibility: "hidden"` : "";

			template += `

			/**
			* ${this.formatDescription(prop.description, prop.private)}
			*/
			${quoteReservedWord(prop.name)}: {
				type: "${type}"${defaultValueString}${mappingString}${visibilityString}
			},`;
		});

		template += `}`;

		return template;
	};

	get enumsString() {
		const enums = this.model.getEnums();
		if (!enums.length) {
			return "";
		}

		return "\n\n" + enums.map(e => `var ${e.enumVarName} = ${e.enumVarValue};`).join("\n");
	};

	get aggregationsString() {
		const aggregations = this.model.getAggregations();
		if (!aggregations.length) {
			return "";
		}

		let template = "";

		// default aggregation
		const defaultAggregation = this.model.getDefaultAggregation();
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
		const associations = this.model.getAssociations();
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
		const events = this.model.getEvents();
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
		const methods = this.model.getMethods();
		if (!methods.length) {
			return "";
		}

		const methodsString = methods.map(method => `"${method.name}"`).join(", ");

		return `,
		methods: [${methodsString}]`;
	};

	get gettersString() {
		const getters = this.model.getGetters();
		if (!getters.length) {
			return "";
		}

		const gettersString = getters.map(getter => `"${getter.name}"`).join(", ");

		return `,
		getters: [${gettersString}]`;
	}

	get designTimeString() {
		if (!this.model.hasDesignTime()) {
			return "";
		}

		const libraryPath = this.library.split(".").join("/");

		return `,
		designtime: "${libraryPath}/designtime/${this.controlName}.designtime"`;
	}

	get methodsJSDoc() {
		const methods = this.model.getMethods();
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
		* @name ${this.library}.${this.controlName}#${method.name}
		* @function
		*/`;
		});

		return result;
	};

	get gettersJSDoc() {
		const getters = this.model.getGetters();
		if (!getters.length) {
			return "";
		}

		let result = "";

		getters.forEach(getter => {
			result += `

		/**
		* ${getter.functionDescription}
		* @public
		* @name ${this.library}.${this.controlName}#${getter.functionName}
		* @function
		*/`;
		});

		return result;
	};
}

module.exports = ControlFileBuilder;
