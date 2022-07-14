/* eslint-disable no-tabs */
const ControlModel = require("./ControlModel.js");
const beautifyJS = require("../utils/beautifyJS.js");
const BuilderBase = require("./BuilderBase.js");

class ControlInstanceBuilder extends BuilderBase {
	constructor(config, library, control, allEntities, nesting = 1) {
		super(config, library, allEntities);

		this.control = control;
		this.className = control.basename;
		this.model = new ControlModel(config, library, control, allEntities);
		this.nesting = nesting;

		this.requiredControls = new Set();
		this.requiredLibraries = new Set();

		this.requiredControls.add(this.control.name);
		this.requiredLibraries.add(this.library);
	}

	generate() {
		if (this.nesting > 4) {
			return "";
		}

		const template = `new ${this.className}({
			${this.properties}${this.aggregations}${this.events}
		})`;

		return beautifyJS(template);
	}

	get properties() {
		const properties = this.model.getProperties();
		if (!properties.length) {
			return "";
		}

		let template = "";

		properties.forEach(prop => {
			if (prop.type === "string") {
				template += this.stringProperty(prop)
			} else if (prop.name === "valueState") {
				template += `valueState:  "Warning",`;
			} else if (prop.type.endsWith("CSSColor") && !prop.name.includes("background")) {
				template += `${prop.name}:  "blue",`;
			}
		});

		return template;
	}

	stringProperty(prop) {
		let template = "";

		let value;
		if (prop.name === "name" && this.control.basename === "Icon") {
			value = "add";
		} else if (prop.name === "icon") {
			value = "employee";
		} else if (prop.name === "value") {
			value = "Control value";
		} else if (prop.name === "valueStateMessage") {
			value = "Value State Message";
		} else if (prop.name === "placeholder") {
			value = "This is my placeholder value";
		} else if (prop.name.match(/text/i)) {
			value = "Some text...";
		}

		if (value) {
			template += `${prop.name}:  "${value}",`;
		}
		return template;
	}

	get aggregations() {
		const aggregations = this.model.getAggregations();
		if (!aggregations.length) {
			return "";
		}

		let template = "";
		aggregations.forEach(agg => {
			if (agg.multiple) {
				template += this.multipleAggregation(agg);
			} else {
				template += this.singleAggregation(agg);
			}
		});

		return template;
	}

	multipleAggregation(agg) {
		return `${agg.name}: [
			${this.generateChildrenForAggregation(agg, 3)}
		],`;
	}

	singleAggregation(agg) {
		return `${agg.name}: ${this.generateChildrenForAggregation(agg, 1)},`;
	}

	generateChildrenForAggregation(agg, howMany = 1) {
		if (!this.hasWebcMainButton()) {
			return "";
		}

		const classOrInterfaceName = agg.type === "sap.ui.core.Control" ? "sap.ui.webc.main.Button" : agg.type;
		let controls;
		const entity = this.allEntities.find(entity => entity.name === classOrInterfaceName);
		if (!entity) {
			console.log("NOT FOUND", classOrInterfaceName)
		}
		if (entity.kind === "class") {
			controls = [entity];
		} else {
			controls = this.allEntities.filter(entity => (entity.implements || []).includes(classOrInterfaceName));
		}

		const arr = [];
		for (let i = 0; i < howMany; i++) {
			const control = controls[i % howMany] || controls[0];
			const builder = new ControlInstanceBuilder(this.config, this.library, control, this.allEntities, this.nesting + 1);

			arr.push(builder.generate());

			[...builder.requiredControls.values()].forEach(rq => {
				this.requiredControls.add(rq);

				const lastDot = rq.lastIndexOf(".");
				this.requiredLibraries.add(rq.substr(0, lastDot));
			});
		}

		return arr.join(",\n");
	}

	get events() {
		const events = this.model.getEvents();
		if (!events.length) {
			return "";
		}

		let template = "";
		events.forEach(event => {
			template += `${event.name}: function(oEvent) { console.log("Event ${event.name} fired for ${this.control.basename} with parameters: ", oEvent.getParameters()); },`;
		});

		return template;
	}

	getRequirePaths() {
		return [...this.requiredControls.values()].map(name => `"${name.replace(/\./g, "/")}"`).join(",\n");
	}

	getRequireModules() {
		const getBaseName = name => name.split(".").pop();
		return [...this.requiredControls.values()].map(getBaseName).join(", ");
	}

	getLibrariesString() {
		return [...this.requiredLibraries.values()].join(", ");
	}

	getButtonsForMethods(instanceVarName, placeAt) {
		if (!this.hasWebcMainButton()) {
			return "";
		}

		const methods = [...this.model.getMethods(), ...this.model.getGetters()];
		if (!methods.length) {
			return "";
		}

		// The button controls is now required
		this.requiredControls.add("sap.ui.webc.main.Button");
		this.requiredLibraries.add("sap.ui.webc.main");

		return methods.map((method, i) => {
			const name = method.functionName || method.name;
			const buttonVarName = `${instanceVarName}${i}Button`;
			const argument1 = name === "showAt" ? buttonVarName : "";
			return `
				var ${buttonVarName} = new Button({
					text: "${name}",
					click: function(oEvent) {
						console.log("Calling ${name}...");
						var result = ${instanceVarName}.${name}(${argument1});
						console.log("... ${name} returned: ", result);
					}
				});
				${buttonVarName}.placeAt("${placeAt}");
			`;
		}).join("\n\n");
	}
}

module.exports = ControlInstanceBuilder;
