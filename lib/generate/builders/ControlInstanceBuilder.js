/* eslint-disable no-tabs */
const beautifyJS = require("../utils/beautifyJS.js");

class ControlInstanceBuilder {
	constructor(control, canUseMainButton = false, nesting = 1) {
		this.control = control;
		this.canUseMainButton = canUseMainButton;
		this.nesting = nesting;

		this.requiredControls = new Set();
		this.requiredLibraries = new Set();

		this.requiredControls.add(this.control.name);
		this.requiredLibraries.add(this.control.library);
	}

	generate() {
		if (this.nesting > 4) {
			return "";
		}

		const template = `new ${this.control.basename}({
			${this.properties}${this.aggregations}${this.events}
		})`;

		return beautifyJS(template);
	}

	get properties() {
		const properties = this.control.mergedProperties;
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
		const aggregations = this.control.mergedAggregations;
		if (!aggregations.length) {
			return "";
		}

		let template = "";
		const done = [];
		aggregations.forEach(agg => {
			if (!done.includes(agg.name)) {
				template += this.multipleAggregation(agg);
				done.push(agg.name);
			}
		});

		return template;
	}

	multipleAggregation(agg) {
        let children;
        if (agg.type === "sap.ui.webc.main.IButton") {
            children = this.generateSingleButtonForAggregation(agg);
        } else {
            children = this.generateChildrenForAggregation(agg, 3);
        }
		if (!children) {
			return "";
		}
		return `${agg.name}: [
			${children}
		],`;
	}

	generateChildrenForAggregation(agg, howMany = 1) {
		if (!this.canUseMainButton) {
			return "";
		}

		const arr = [];
		for (let i = 0; i < howMany; i++) {
			const control = agg.examples[i % howMany] || agg.examples[0];
			// if (!control) {
			//	 console.log(agg.name, agg.examples)
			// }
			const builder = new ControlInstanceBuilder(control, this.canUseMainButton, this.nesting + 1);

			arr.push(builder.generate());

			[...builder.requiredControls.values()].forEach(rq => {
				this.requiredControls.add(rq);

				const lastDot = rq.lastIndexOf(".");
				this.requiredLibraries.add(rq.substr(0, lastDot));
			});
		}

		return arr.filter(str => !!str).join(",\n");
	}

    generateSingleButtonForAggregation(agg) {
        if (!this.canUseMainButton) {
            return "";
        }

        const arr = [];

        const control = agg.examples.find(ctr => ctr.name === "sap.ui.webc.main.Button");
        const builder = new ControlInstanceBuilder(control, this.canUseMainButton, this.nesting + 1);

        arr.push(builder.generate());

        [...builder.requiredControls.values()].forEach(rq => {
            this.requiredControls.add(rq);

            const lastDot = rq.lastIndexOf(".");
            this.requiredLibraries.add(rq.substr(0, lastDot));
        });

        return arr.filter(str => !!str).join(",\n");
    }

	get events() {
		const events = this.control.mergedEvents;
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
		if (!this.canUseMainButton) {
			return "";
		}

		const methods = [...this.control.mergedMethods, ...this.control.mergedGetters];
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
