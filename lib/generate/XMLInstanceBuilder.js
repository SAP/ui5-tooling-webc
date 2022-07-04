const ControlModel = require("./ControlModel.js");
const postFormat = require("./format.js");
const beautify = require('js-beautify').html;

const capitalizeFirst = str => str.substr(0, 1).toUpperCase() + str.substr(1);

class XMLInstanceBuilder {
	constructor(config, library, control, allEntities, nesting = 1) {
        this.config = config;
		this.library = library;
		this.control = control;
		this.allEntities = allEntities;
		this.className = control.basename;
		this.model = new ControlModel(config, library, control, allEntities);
		this.nesting = nesting;

		this.requiredControls = new Set();
		this.requiredLibraries = new Set();

		this.requiredControls.add(this.control.name);
		this.requiredLibraries.add(this.library);
	}

	getName() {
		return this.control.name.includes("fiori") ? `fiori:${this.control.basename}` : this.control.basename;
	}

	generate(withEvents = true) {
		if (this.nesting > 4) {
			return "";
		}

		let template = `<${this.getName()} ${this.properties} ${withEvents ? this.events : ""}>${this.aggregations}</${this.getName()}>`;

		return beautify(template);
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
				template += `valueState="Warning" `;
			} else if (prop.type.endsWith("CSSColor")) {
				template += `${prop.name}="blue" `;
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
			template += `${prop.name}="${value}" `;
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
		const aggName = this.control.name.includes("fiori") ? `fiori:${agg.name}` : agg.name;
		return `<${aggName}>
			${this.generateChildrenForAggregation(agg, 3)}
		</${aggName}>`;
	}

	singleAggregation(agg) {
		const aggName = this.control.name.includes("fiori") ? `fiori:${agg.name}` : agg.name;
		return `<${aggName}>${this.generateChildrenForAggregation(agg, 1)}</${aggName}>`;
	}

	generateChildrenForAggregation(agg, howMany = 1) {
		const classOrInterfaceName = agg.type === "sap.ui.core.Control" ? "sap.ui.webc.main.Button" : agg.type;
		let control;
		const entity = this.allEntities.find(entity => entity.name === classOrInterfaceName);
		if (entity.kind === "class") {
			control = entity;
		} else {
			control = this.allEntities.find(entity => (entity.implements || []).includes(classOrInterfaceName));
		}
		const builder = new XMLInstanceBuilder(this.config, this.library, control, this.allEntities, this.nesting + 1);

		const arr = [];
		for (let i = 0; i< howMany; i++) {
			arr.push(builder.generate(false));
		}

		[...builder.requiredControls.values()].forEach(rq => {
			this.requiredControls.add(rq);

			const lastDot = rq.lastIndexOf(".");
			this.requiredLibraries.add(rq.substr(0, lastDot));
		});

		return arr.join("\n");
	}

	get events() {
		const events = this.model.getEvents();
		if (!events.length) {
			return "";
		}

		let template = "";
		events.forEach(event => {
			template += `${event.name}="handle${capitalizeFirst(event.name)}" `;
		});

		return template;
	}

	getSampleEventHandlers() {
		const events = this.model.getEvents();

		return events.map(event => {
			return `,handle${capitalizeFirst(event.name)}: function(oEvent) {
				var demoToast = this.getView().byId("demoToast");
				demoToast.setText("Event ${event.name} fired.");
				demoToast.show();
			}`;
		}).join("");
	}
}

module.exports = XMLInstanceBuilder;
