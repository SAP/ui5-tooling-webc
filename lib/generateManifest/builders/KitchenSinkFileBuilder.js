/* eslint-disable no-tabs */
const beautifyHTML = require("js-beautify").html;

const ControlInstanceBuilder = require("./ControlInstanceBuilder.js");
const beautifyJS = require("../utils/beautifyJS.js");

class KitchenSinkFileBuilder {
	constructor(controls, canUseMainButton) {

		this.controlsWithTestPages = controls;
		this.requiredControls = new Set();
		this.requiredLibraries = new Set();
		this.instances = [];

		this.controlsWithTestPages.forEach(control => {
			const instanceBuilder = new ControlInstanceBuilder(control, canUseMainButton);

			const varName = `o${control.basename}`; // the variable name to assign the instance to
			const instance = instanceBuilder.generate();
			const methodButtons = instanceBuilder.getButtonsForMethods(varName, `methods${control.basename}`);

			this.instances.push({
				control,
				instance,
				methodButtons
			});
			[...instanceBuilder.requiredControls.values()].forEach(rq => {
				this.requiredControls.add(rq);
			});
			[...instanceBuilder.requiredLibraries.values()].forEach(rl => {
				this.requiredLibraries.add(rl);
			});
		});
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

	generateHTML() {
		const testBlocks = this.controlsWithTestPages.map((control, index) => `
			<h1>${index}. ${control.basename}</h1>
			<div id="methods${control.basename}"></div>
			<div id="test${control.basename}"></div>
			<br><br>`).join("\n\n");

		const instancesString = this.instances.map(controlData => {
			const varName = `o${controlData.control.basename}`; // the variable name to assign the instance to
			return `${controlData.methodButtons}
			 		var ${varName} = ${controlData.instance};
					${varName}.placeAt("test${controlData.control.basename}");`;
		}).join("\n\n");

		const javascript = `
			sap.ui.getCore().attachInit(function () {
				sap.ui.require([
					${this.getRequirePaths()}
				], function (
					 ${this.getRequireModules()}
				) {
					${instancesString}
				});
			});
		`;

		const template = `
		<!DOCTYPE HTML>
		<html>
		<head>
			<meta http-equiv="X-UA-Compatible" content="IE=edge">
			<meta charset="utf-8">
			<title>Kitchen sink - ${this.library}</title>
			<script src="shared-config.js"></script>
			<script src="../../../../../resources/sap-ui-core.js" id="sap-ui-bootstrap"
					data-sap-ui-libs="${this.getLibrariesString()}">
			</script>

			<script>
			  ${beautifyJS(javascript)}
			</script>
		</head>

		<body id="body" class="sapUiBody">
			${testBlocks}
		</body>
		</html>`;

		return beautifyHTML(template);
	}
}

module.exports = KitchenSinkFileBuilder;
