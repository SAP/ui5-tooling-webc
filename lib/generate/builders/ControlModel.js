const normalizeType = require("../utils/normalizeType.js");

// String utils
const kebabToCamelCase = string => toCamelCase(string.split("-"));
const toCamelCase = parts => {
    return parts.map((string, index) => {
        return index === 0 ? string.toLowerCase() : string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }).join("");
};

const compareByName = (a, b) => {
    // public first
    if (a.name.startsWith("_") && !b.name.startsWith("_")) {
        return 1;
    }
    if (!a.name.startsWith("_") && b.name.startsWith("_")) {
        return -1;
    }

    // then normally by name
    if (a.name < b.name) {
        return -1;
    }
    if (a.name > b.name) {
        return 1;
    }
    return 0;
};

class ControlModel {
    constructor(config, library, control, allEntities) {
        this.config = config;
        this.library = library;
        this.control = control;
        this.fullName = control.name;
        this.controlName = control.basename;
        this.allEntities = allEntities;

        this.neededEnums = new Set();
        this.extraLibraries = new Set();

        this.interfaces = [];
        this.properties = [];
        this.enums = [];
        this.defaultAggregation = "";
        this.aggregations = [];
        this.associations = [];
        this.events = [];
        this.methods = [];
        this.getters = [];

        this.generate();
    }

    generate() {
        this.generateInterfaces();
        this.generateProperties();
        this.generateEnums();
        this.generateAggregations();
        this.generateAssociations();
        this.generateDefaultAggregation();
        this.generateEvents();
        this.generateMethods();
        this.generateGetters();
    };

    generateInterfaces() {
        if (this.control.implements) {
            this.interfaces = this.control.implements;
        }
        if (this.config.includeLabelEnablement?.includes(this.fullName)) {
            this.interfaces.push("sap.ui.core.Label");
        }
        if (this.config.includeFormSupport?.includes(this.fullName)) {
            this.interfaces.push("sap.ui.core.IFormContent");
        }
        if (this.config.includeSemanticFormSupport?.includes(this.fullName)) {
            this.interfaces.push("sap.ui.core.ISemanticFormContent");
        }
    }

    getInterfaces() {
        return this.interfaces;
    }

    buildPropertyType(propInfo) {
        let type = propInfo.type;

        const typeInfo = this.allEntities.find(item => item.basename === type);
        if (typeInfo) {
            type = typeInfo.name
        }

        return normalizeType(type);
    };

    supportsEnabled() {
        return this.control.properties.find(prop => prop.name === "disabled");
    }

    /**
     * Whether the component has a "name" property, but in the context of forms, f.e. not icon's name
     * @returns {*}
     */
    hasFormNameProperty() {
        const hasFormSupport = this.config.includeFormSupport?.includes(this.fullName);
        const hasNameProperty = this.control.properties.find(prop => prop.name === "name");
        return hasFormSupport && hasNameProperty
    }

    // The properties section
    generateProperties() {
        const propertiesExcludeList = ["stableDomRef", "disabled", "tooltip"];

        // text slot property
        const textSlot = this.control.slots.find(slot => slot.visibility === "public" && this.isTextSlot(slot));
        if (textSlot) {
            this.properties.push({
                name: textSlot.propertyName || "text",
                description: "Defines the content of the control",
                type: "string",
                defaultValue: `""`,
                mapping: "textContent"
            });
        }

        // normal properties
        const properties = (this.control.properties || []).filter(prop => prop.visibility === "public" && !prop.readonly && !propertiesExcludeList.includes(prop.name) && !this.isAssociationProperty(prop)); //  && prop.type !== "undefined"
        properties.forEach(prop => {
            const type = this.buildPropertyType(prop);
            if (type.startsWith("sap.ui.") && prop.defaultValue) {
                this.neededEnums.add(type);
            }

            let defaultValue = prop.defaultValue;
            if (type.startsWith("sap.ui") && prop.defaultValue) {
                defaultValue = `${prop.type}.${prop.defaultValue.replace(/"/g, "")}`
            }
            if (type === "object" && !defaultValue) {
                defaultValue = `{}`;
            }

            this.properties.push({
                name: prop.name,
                description: prop.description,
                type,
                defaultValue
            });
        });

        // value state message property
        const valueStateMessageSlot = this.control.slots.find(slot => slot.name === "valueStateMessage");
        if (valueStateMessageSlot) {
            this.properties.push({
                name: "valueStateMessage",
                description: `Defines the value state message that will be displayed as pop up under the contorl.\n<br><br>\n\n<b>Note:</b> If not specified, a default text (in the respective language) will be displayed.`,
                type: "string",
                defaultValue: `""`,
                mapping: {
                    type: "slot",
                    to: "div"
                }
            });
        }

        // Changing enabled to disabled and adding enabled propagator
        if (this.supportsEnabled()) {
            this.properties.push({
                name: "enabled",
                description: "Defines whether the control is enabled. A disabled control can't be interacted with, and it is not in the tab chain.",
                type: "boolean",
                defaultValue: "true",
                mapping: {
                    type: "attribute",
                    to: "disabled",
                    formatter: "_mapEnabled"
                }
            });
        }

        // Additional properties - width
        if (this.config.additionalProperties?.width?.includes(this.fullName)) {
            this.properties.push({
                name: "width",
                description: "Defines the width of the control",
                type: "sap.ui.core.CSSSize",
                mapping: "style"
            });
        }

        // Additional properties - height
        if (this.config.additionalProperties?.height?.includes(this.fullName)) {
            this.properties.push({
                name: "height",
                description: "Defines the height of the control",
                type: "sap.ui.core.CSSSize",
                mapping: "style"
            });
        }

        // Additional properties - display
        if (this.config.additionalProperties?.display?.includes(this.fullName)) {
            this.properties.push({
                name: "display",
                description: "Defines whether the control will be rendered as a block or inline HTML element",
                type: "string",
                defaultValue: `"inline-block"`,
                mapping: "style"
            });
        }

        // Additional properties - color
        if (this.config.additionalProperties?.color?.includes(this.fullName)) {
            this.properties.push({
                name: "color",
                description: "Defines the color of the control",
                type: "sap.ui.core.CSSColor",
                mapping: "style"
            });
        }

        // Additional properties - backgroundColor
        if (this.config.additionalProperties?.backgroundColor?.includes(this.fullName)) {
            this.properties.push({
                name: "backgroundColor",
                description: "Defines the background color of the control",
                type: "sap.ui.core.CSSColor",
                mapping: "style"
            });
        }

        // Additional properties - textDirection
        if (this.config.additionalProperties?.textDirection?.includes(this.fullName)) {
            this.properties.push({
                name: "textDirection",
                description: "Specifies the element's text directionality with enumerated options. By default, the control inherits text direction from the DOM.",
                type: "sap.ui.core.TextDirection",
                defaultValue: "TextDirection.Inherit",
                mapping: {
                    type: "attribute",
                    to: "dir",
                    formatter: "_mapTextDirection"
                }
            });

            this.extraLibraries.add("sap.ui.core");
            this.neededEnums.add("sap.ui.core.TextDirection");
        }

        // Semantic form value support - special property
        if (this.config.includeSemanticFormSupport?.includes(this.fullName)) {
            this.properties.push({
                name: "_semanticFormValue",
                description: "The value for sap.ui.core.ISemanticFormContent interface.",
                type: "string",
                defaultValue: `""`,
                private: true
            });
        }

        this.properties.sort(compareByName);
    };

    getProperties() {
        return this.properties;
    }

    generateEnums() {
        [...this.neededEnums.values()].forEach(e => {
            const lastDot = e.lastIndexOf(".");
            const lib = e.substr(0, lastDot);
            const name = e.substr(lastDot + 1);
            let libraryVarName;

            if (lib === this.library) {
                libraryVarName = "library";
            } else {
                this.extraLibraries.add(lib);
                libraryVarName = lib.split(".").pop() + "Library"; // f.e. sap.ui.core -> coreLibrary, sap.ui.webc.main -> mainLibrary
            }

            this.enums.push({
                name: e,
                enumVarName: name,
                enumVarValue: `${libraryVarName}.${name}`
            });
        });

        this.enums.sort(compareByName);
    };

    getEnums() {
        return this.enums;
    }

    isTextSlot(slotData) {
        return slotData.type.startsWith("Node") && slotData.description.includes("use text in order to preserve the intended design");
    }

    // The aggregations section
    generateAggregations() {
        const slots = (this.control.slots || []).filter(slot => slot.visibility === "public" && !this.isTextSlot(slot) && slot.name !== "valueStateMessage");
        if (!slots.length) {
            return;
        }

        slots.forEach((slot) => {
            const name = slot.name === "default" ? (slot.propertyName || "content") : slot.name;
            let type;
            if (slot.type.startsWith("Node") || slot.type.startsWith("HTMLElement")) {
                type = "sap.ui.core.Control";
            } else {
                type = slot.type.split("[]")[0];
            }
            const multiple = slot.type.endsWith("[]");

            this.aggregations.push({
                name,
                description: slot.description,
                type,
                multiple,
                isDefault: slot.name === "default"
            });
        });

        this.aggregations.sort(compareByName);
    }

    getAggregations() {
        return this.aggregations;
    }

    generateAssociations() {
        const associationProperties = (this.control.properties || []).filter(prop => prop.visibility === "public" && !prop.readonly && this.isAssociationProperty(prop));
        associationProperties.forEach(prop => {
            const currentProperty = this.getAssociationProperties().find(x => x.name === prop.name);
            if (currentProperty) {
                this.associations.push(currentProperty.associationBuilder(prop));
            } else {
                this.associations.push({
                    name: prop.name,
                    description: prop.description,
                    type: "sap.ui.core.Control",
                    multiple: false
                });
            }
        });
    }

    getAssociations() {
        return this.associations;
    }

    getAssociationProperties() {
        return [
            {
                name: "for",
                associationBuilder: prop => {
                    return {
                        name: "labelFor",
                        description: `Association to the labelled control.\n<br>\nBy default, the label sets the for attribute to the ID of the labelled control. This can be changed by implementing the function getIdForLabel on the labelled control.`, // prop.description,
                        type: "sap.ui.core.Control",
                        multiple: false,
                        mappingName: prop.name
                    };
                }
            },
            {
                name: "accessibleNameRef",
                associationBuilder: prop => {
                    return {
                        name: "ariaLabelledBy",
                        description: `Receives id(or many ids) of the controls that label this control.`, // prop.description,
                        type: "sap.ui.core.Control",
                        multiple: true,
                        mappingName: prop.name,
                        formatter: "_getAriaLabelledByForRendering"
                    };
                }
            }
        ];
    }

    hasAssociationLikeDescription(description) {
        const desc = description.toLowerCase();
        return desc.includes("id of") || desc.includes("id or dom reference");
    }

    isAssociationProperty(prop) {
        return this.hasAssociationLikeDescription(prop.description) || !!this.getAssociationProperties().find(x => x.name === prop.name);
    }

    generateDefaultAggregation() {
        const slot = this.control.slots.find(slot => slot.visibility === "public" && slot.name === "default" && !this.isTextSlot(slot));
        if (slot) {
            this.defaultAggregation = slot.propertyName || "content"
        }
    }

    getDefaultAggregation() {
        return this.defaultAggregation;
    }

    generateEvents() {
        const events = this.control.events.filter(event => event.visibility === "public");

        // click
        if (!this.control.events.find(ev => ev.name === "click") && this.config.additionalEvents?.click?.includes(this.fullName)) {
            this.events.push({
                name: "click",
                description: "Fired when the user clicks the control",
                parameters: []
            });
        }

        (events || []).forEach((event) => {
            this.events.push({
                name: kebabToCamelCase(event.name),
                description: event.description,
                parameters: (event.parameters || []).map(param => {
                    param.type = normalizeType(param.type);
                    return param;
                }),
                allowPreventDefault: !!event.allowPreventDefault
            });
        });

        this.events.sort(compareByName);
    };

    getEvents() {
        return this.events;
    }

    generateMethods() {
        this.methods = (this.control.methods || []).filter(method => method.visibility === "public");
        this.methods.forEach(method => {
            (method.parameters || []).forEach(param => {
                param.type = normalizeType(param.type);
            });
        });

        this.methods.sort(compareByName);
    };

    getMethods() {
        return this.methods;
    }

    generateGetters() {
        this.getters = this.control.properties.filter(prop => prop.visibility === "public" && prop.readonly);
        this.getters.forEach(getter => {
            getter.functionName = "get" + getter.name.substr(0, 1).toUpperCase() + getter.name.substr(1);
            let functionDescription;
            if (getter.description.match(/^returns/i)) {
                functionDescription = getter.description; // The getter text already says "Returns... something"
            } else { // The getter text directly starts with the noun
                functionDescription = "Returns the " + getter.description.substr(0, 1).toLowerCase() + getter.description.substr(1);
            }
            getter.functionDescription = functionDescription;
        });

        this.getters.sort(compareByName);
    }

    getGetters() {
        return this.getters;
    }

    hasDesignTime() {
        return Object.prototype.hasOwnProperty.call(this.config.designtime || {}, this.fullName);
    }
}

module.exports = ControlModel;
