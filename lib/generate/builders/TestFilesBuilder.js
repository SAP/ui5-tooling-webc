/* eslint-disable no-tabs */
const beautifyHTML = require("js-beautify").html;

const BuilderBase = require("./BuilderBase.js");
const ControlInstanceBuilder = require("./ControlInstanceBuilder.js");
const beautifyJS = require("../utils/beautifyJS.js");

class TestFilesBuilder extends BuilderBase {
	constructor(config, library, control, allControls) {
		super(config, library, allControls);
		this.control = control;
		this.name = this.control.basename;

		const instanceBuilder = new ControlInstanceBuilder(config, this.library, this.control, this.allEntities);

		this.varName = `o${this.control.basename}`; // the variable name to assign the instance to

		// Call these 2 methods first to build all required controls & libraries
		this.instance = instanceBuilder.generate();
		this.methodButtons = instanceBuilder.getButtonsForMethods(this.varName, "methodButtons");

		this.libraries = instanceBuilder.getLibrariesString();
		this.requirePaths = instanceBuilder.getRequirePaths();
		this.requireModules = instanceBuilder.getRequireModules();
	}

	generateTestPage() {
		const template = `
		<!DOCTYPE HTML>
		<html>
		<head>
			<meta charset="utf-8">
			<title>${this.name} - ${this.library}</title>
			<script src="shared-config.js"></script>
			<script src="../../../../../resources/sap-ui-core.js"
				id="sap-ui-bootstrap"
				data-sap-ui-libs="${this.libraries}"
				data-sap-ui-resourceroots='{
					"qunit.internal.acc": "../../../../../test-resources/sap/ui/core/qunit/internal/acc"
				}' >
			</script>

			<script>
			  sap.ui.getCore().attachInit(function () {
				sap.ui.require([
					${this.requirePaths}
				], function (
					 ${this.requireModules}
				) {
					${this.methodButtons}

					var ${this.varName} = ${this.instance};
					${this.varName}.placeAt("testControl");
				});
			});
			</script>
		</head>
		<body id="body" class="sapUiBody">
			<div id="methodButtons"></div>
			<br><br>
			<div id="testControl"></div>
		</body>
		</html>`;

		return beautifyHTML(template, {
			wrap_attributes: ["preserve"]
		});
	}

	generateQUnit() {
		const instanceNoComments = this.instance.replace(/console\.log/g, "// console.log");

		const template = `
/*global QUnit */
/*eslint no-undef:1, no-unused-vars:1, strict: 1 */
sap.ui.define([
	"sap/ui/qunit/utils/createAndAppendDiv",
	"sap/ui/core/Core",
	${this.requirePaths}
], function (createAndAppendDiv, Core, ${this.requireModules}) {
	"use strict";

	createAndAppendDiv("uiArea");

	QUnit.module("Rendering", {
		beforeEach : function() {
			this.${this.varName} = ${instanceNoComments};
			this.${this.varName}.placeAt("uiArea");
			Core.applyChanges();
		},
		afterEach : function() {
			this.${this.varName}.destroy();
			this.${this.varName} = null;
		}
	});

	QUnit.test("Should render", function(assert) {
		assert.ok(this.${this.varName}.$(), "Rendered");
	});
});`;

		return beautifyJS(template);
	}
}

module.exports = TestFilesBuilder;
