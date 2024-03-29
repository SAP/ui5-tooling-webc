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

class ComponentsPackage {
    constructor(name, settings, config) {
        this.name = name;
        this.namespace = settings.namespace;
        this.manifest = settings.manifest;
        this.fillMap();
    }

    fillMap() {
        this.manifest.modules.forEach(module => {
            module.declarations.forEach(declaration => {
                if (declaration.tagName) {
                    const fullName = `${this.namespace}.${declaration.name}`;
                    this.constructor.tagToNameMap.set(declaration.tagName, fullName);
                }
            });
        });
    }

    generate() {
        this.parseManifest();
        this.createDesignTimeData();
    }

    getDeclaration(modulePath, declarationName) {
        const module = this.manifest.modules.find(mod => mod.path === modulePath);
        if (!module) {
            return;
        }
        return module.declarations?.find(declaration => declaration.name === declarationName);
    }

    parseManifest() {
        this.controls = [];
        this.enums = [];
        this.interfaces = [];
        this.manifest.modules.forEach(module => {
            module.declarations.forEach(declaration => {
                if (declaration._ui5privacy === "private") {
                    return;
                }

                if (declaration.kind === "interface") {
                    this.createInterface(declaration);
                } else if (declaration.kind === "enum") {
                    this.createEnum(declaration);
                } else if (declaration.kind === "class" && declaration.customElement && declaration.name !== "UI5Element") {
                    this.createControl(declaration);
                }
            });
        });
    }

    createInterface(declaration) {
        const name = `${this.namespace}.${declaration.name}`;
        this.interfaces.push({
            name,
            description: this.constructor.replaceTagsWithFullNames(declaration.description),
            version: this.constructor.getVersion(name)
        });
    }

    createEnum(declaration) {
        const name = `${this.namespace}.${declaration.name}`;
        this.enums.push({
            name,
            basename: declaration.name,
            description: this.constructor.replaceTagsWithFullNames(declaration.description),
            version: this.constructor.getVersion(name),
            properties: declaration.members.map(member => {
                return {
                    name: member.name,
                    description: this.constructor.replaceTagsWithFullNames(member.description)
                }
            })
        });
    }

    createControl(declaration) {
        const fullName = `${this.namespace}.${declaration.name}`;
        /*
        if (this.constructor.config?.noControl?.includes(fullName)) {
            return;
        }
        */

        const control = {
            library: this.namespace,
            basename: declaration.name,
            name: fullName,
            description: this.constructor.replaceTagsWithFullNames(declaration.description),
            version: this.constructor.getVersion(fullName),
            tag: declaration.tagName,
            tagWithSuffix: declaration.tagName ? `${declaration.tagName}${this.constructor.config.suffix || ""}` : undefined,
            hasLabelEnablement: this.constructor.config.includeLabelEnablement?.includes(fullName),
            hasFormSupport: this.constructor.config.includeFormSupport?.includes(fullName),
            hasSemanticFormSupport: this.constructor.config.includeSemanticFormSupport?.includes(fullName),
            features: (this.constructor.config.features || {})[fullName],
            designtime: (this.constructor.config.designtime || {})[fullName] ? `${this.namespace.split(".").join("/")}/designtime/${declaration.name}.designtime` : ""
        };

        let interfaces = [];
        let properties = [];
        let aggregations = [];
        let associations = [];
        let events = [];
        let methods = [];
        let getters = [];
        let defaultAggregation;
        const neededEnums = new Set();
        const neededLibraries = new Set();
        const currentPackage = this;
        // while (declaration) {
            const baseClass = currentPackage.getBaseClassForDeclaration(declaration);
            interfaces = [...currentPackage.getInterfacesForDeclaration(declaration), ...interfaces];
            const { props, enums, libraries } = currentPackage.getPropertiesForDeclaration(declaration);
            properties = [...props, ...properties];
            aggregations = [...currentPackage.getAggregationsForDeclaration(declaration), ...aggregations];
            associations = [...currentPackage.getAssociationsForDeclaration(declaration), ...associations];
            events = [...currentPackage.getEventsForDeclaration(declaration), ...events];
            methods = [...currentPackage.getMethodsForDeclaration(declaration), ...methods];
            getters = [...currentPackage.getGettersForDeclaration(declaration), ...getters];
            if (!defaultAggregation) {
                defaultAggregation = currentPackage.getDefaultAggregationForDeclaration(declaration);
            }
            enums.forEach(e => {
                if (!neededEnums.has(e)) {
                    neededEnums.add(e);
                }
            });
            libraries.forEach(l => {
                if (l !== this.namespace && !neededLibraries.has(l)) {
                    neededLibraries.add(l);
                }
            });

            // currentPackage = this.constructor.getParentPackage(declaration);
            // declaration = currentPackage?.getDeclaration(declaration.superclass.module, declaration.superclass.name)
        // }
        control.baseClass = baseClass;
        control.interfaces = interfaces.sort();
        control.properties = properties.sort(compareByName);
        control.aggregations = aggregations.sort(compareByName);
        control.associations = associations.sort(compareByName);
        control.events = events.sort(compareByName);
        control.methods = methods.sort(compareByName);
        control.getters = getters.sort(compareByName);
        control.defaultAggregation = defaultAggregation;
        control.enums = [...neededEnums];
        control.libraries = [...neededLibraries];

        control.supportsEnabled = control.properties.find(prop => prop.name === "enabled");

        this.controls.push(control);
    }

    createDesignTimeData() {
        this.designTimeData = {};
        if (!this.constructor.config?.designtime) {
            return;
        }
        for (const fullName in this.constructor.config.designtime) {
            if (fullName.startsWith(this.namespace)) {
                this.designTimeData[fullName] = this.constructor.config.designtime[fullName];
            }
        }
    }

    getBaseClassForDeclaration(declaration) {
        const baseClassData = declaration.superclass;
        const baseClassName = baseClassData.name;

        if (baseClassName === "UI5Element") {
            return {
                path: "sap/ui/core/webc/WebComponent",
                name: "WebComponent",
                fullName: "sap.ui.core.webc.WebComponent"
            };
        }

        const baseClassPackage = this.constructor.all.get(baseClassData.package);
        const baseClassNamespace = baseClassPackage.namespace;
        return {
            path: `${baseClassNamespace.split(".").join("/")}/${baseClassName}`,
            name: baseClassName,
            fullName: `${baseClassNamespace}.${baseClassName}`
        };
    }

    getInterfacesForDeclaration(declaration) {
        const fullControlName = `${this.namespace}.${declaration.name}`;

        const interfaces = (declaration._ui5implements || []).map(interfaceData => {
            const interfacePackage = this.constructor.all.get(interfaceData.package);
            const interfaceNamespace = interfacePackage.namespace;
            const interfaceName = interfaceData.name;
            return `${interfaceNamespace}.${interfaceName}`;
        });

        if (this.constructor.config.includeLabelEnablement?.includes(fullControlName)) {
            interfaces.push("sap.ui.core.Label");
        }
        if (this.constructor.config.includeFormSupport?.includes(fullControlName)) {
            interfaces.push("sap.ui.core.IFormContent");
        }
        if (this.constructor.config.includeSemanticFormSupport?.includes(fullControlName)) {
            interfaces.push("sap.ui.core.ISemanticFormContent");
        }

        return interfaces;
    }

    getPropertiesForDeclaration(declaration) {
        const propertiesExcludeList = ["stableDomRef", "disabled", "tooltip"];
        const properties = [];
        const enums = [];
        const libraries = [];

        // "text" (generally text slot) property
        const textSlot = declaration.slots?.find(slot => slot._ui5privacy === "public" && this.constructor.isTextSlot(slot));
        if (textSlot) {
            properties.push({
                name: textSlot._ui5propertyName || "text",
                description: "Defines the content of the control",
                type: "string",
                defaultValue: `""`,
                mapping: "textContent"
            });
        }

        // "valueStateMessage" property
        const valueStateMessageSlot = declaration.slots?.find(slot => slot.name === "valueStateMessage");
        if (valueStateMessageSlot) {
            properties.push({
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

        // "enabled" property
        const disabledProperty = declaration.members?.find(member => member.privacy === "public" && member.name === "disabled");
        if (disabledProperty) {
            properties.push({
                name: "enabled",
                description: "Defines whether the control is enabled. A disabled control can't be interacted with, and it is not in the tab chain.",
                type: "boolean",
                defaultValue: "true",
                mapping: {
                    type: "property",
                    to: "disabled",
                    formatter: "_mapEnabled"
                }
            });
        }

        // normal properties
        (declaration.members || []).filter(member => {
           return member.kind === "field" &&
               member.privacy === "public" && // skip private properties
               !member.inheritedFrom && // skip inherited properties, the whole inheritance change will be traversed
               !member.readonly && // skip read-only (getters)
               !propertiesExcludeList.includes(member.name) && // skip properties that have special UI5 implementation
               !this.constructor.isAssociationProperty(member); // skip association properties (they will be created as associtions)
        }).forEach(member => {
            const { type, defaultValue, enumName, library } = this.constructor.getTypeAndDefault(member);

            properties.push({
                name: member.name,
                description: this.constructor.replaceTagsWithFullNames(member.description),
                type,
                defaultValue
            });

            if (enumName && !enums.includes(enumName)) {
                enums.push(enumName);
            }

            if (library && !libraries.includes(library)) {
                libraries.push(library);
            }
        });

        const fullControlName = `${this.namespace}.${declaration.name}`;
        const additionalProperties = this.constructor.config.additionalProperties;

        // Additional properties - width
        if (additionalProperties?.width?.includes(fullControlName)) {
            properties.push({
                name: "width",
                description: "Defines the width of the control",
                type: "sap.ui.core.CSSSize",
                mapping: "style"
            });
        }

        // Additional properties - height
        if (additionalProperties?.height?.includes(fullControlName)) {
            properties.push({
                name: "height",
                description: "Defines the height of the control",
                type: "sap.ui.core.CSSSize",
                mapping: "style"
            });
        }

        // Additional properties - display
        if (additionalProperties?.display?.includes(fullControlName)) {
            properties.push({
                name: "display",
                description: "Defines whether the control will be rendered as a block or inline HTML element",
                type: "string",
                defaultValue: `"inline-block"`,
                mapping: "style"
            });
        }

        // Additional properties - color
        if (additionalProperties?.color?.includes(fullControlName)) {
            properties.push({
                name: "color",
                description: "Defines the color of the control",
                type: "sap.ui.core.CSSColor",
                mapping: "style"
            });
        }

        // Additional properties - backgroundColor
        if (additionalProperties?.backgroundColor?.includes(fullControlName)) {
            properties.push({
                name: "backgroundColor",
                description: "Defines the background color of the control",
                type: "sap.ui.core.CSSColor",
                mapping: "style"
            });
        }

        // Additional properties - textDirection
        if (additionalProperties?.textDirection?.includes(fullControlName)) {
            properties.push({
                name: "textDirection",
                description: "Specifies the element's text directionality with enumerated options. By default, the control inherits text direction from the DOM.",
                type: "sap.ui.core.TextDirection",
                defaultValue: "TextDirection.Inherit",
                mapping: {
                    type: "property",
                    to: "dir",
                    formatter: "_mapTextDirection"
                }
            });

            libraries.push("sap.ui.core");
            enums.push("sap.ui.core.TextDirection");
        }

        // Semantic form value support - special property
        if (this.constructor.config.includeSemanticFormSupport?.includes(fullControlName)) {
            properties.push({
                name: "_semanticFormValue",
                description: "The value for sap.ui.core.ISemanticFormContent interface.",
                type: "string",
                defaultValue: `""`,
                private: true
            });
        }

        return { props: properties, enums, libraries };
    }

    getAggregationsForDeclaration(declaration) {
        const aggregations = [];
        (declaration.slots || []).filter(slot => {
            return slot._ui5privacy === "public" &&
                !this.constructor.isTextSlot(slot) &&
                slot.name !== "valueStateMessage";
        }).forEach(slot => {
            const name = slot.name === "default" ? (slot._ui5propertyName || "content") : slot.name;
            const type = this.constructor.getAggregationType(slot);

            aggregations.push({
                name,
                description: this.constructor.replaceTagsWithFullNames(slot.description),
                type,
                multiple: true,
                isDefault: slot.name === "default"
            });
        });

        return aggregations;
    }

    getDefaultAggregationForDeclaration(declaration) {
        const slot = declaration.slots?.find(slot => slot._ui5privacy === "public" && slot.name === "default" && !this.constructor.isTextSlot(slot));
        if (slot) {
            return slot._ui5propertyName || "content";
        }
    }

    getAssociationsForDeclaration(declaration) {
        const associations = [];

        (declaration.members || []).filter(prop => {
            return prop.privacy === "public" &&
                !prop.inheritedFrom &&
                !prop.readonly &&
                this.constructor.isAssociationProperty(prop);
        }).forEach(prop => {
            if (this.constructor.associationProperties[prop.name]) {
                associations.push({
                    ...this.constructor.associationProperties[prop.name],
                    mappingName: prop.name
                });
            } else {
                associations.push({
                    name: prop.name,
                    description: this.constructor.replaceTagsWithFullNames(prop.description),
                    type: "sap.ui.core.Control",
                    multiple: false
                });
            }
        });

        return associations;
    }

    getEventsForDeclaration(declaration) {
        const fullControlName = `${this.namespace}.${declaration.name}`;
        const events = (declaration.events || []).filter(event => event._ui5privacy === "public" && !event.inheritedFrom).map(event => {
            return {
                name: kebabToCamelCase(event.name),
                description: this.constructor.replaceTagsWithFullNames(event.description),
                parameters: (event._ui5parameters || []).filter(param => param._ui5privacy === "public").map(param => {
                    return {
                        name: param.name,
                        type: this.constructor.getParameterType(param),
                        description: this.constructor.replaceTagsWithFullNames(param.description)
                    };
                }),
                allowPreventDefault: !!event._ui5allowPreventDefault
            };
        });

        // click
        if (!events.find(ev => ev.name === "click") && this.constructor.config.additionalEvents?.click?.includes(fullControlName)) {
            events.push({
                name: "click",
                description: "Fired when the user clicks the control",
                parameters: []
            });
        }

        return events;
    }

    getMethodsForDeclaration(declaration) {
        const methods = (declaration.members || []).filter(member => member.kind === "method" && !member.inheritedFrom).map(method => {
            return {
                name: method.name,
                description: this.constructor.replaceTagsWithFullNames(method.description),
                return: {
                    type: method.return.type.text,
                    description: this.constructor.replaceTagsWithFullNames(method.return.description)
                },
                parameters: (method.parameters || []).map(param => {
                    return {
                        name: param.name,
                        description: this.constructor.replaceTagsWithFullNames(param.description),
                        type: this.constructor.getParameterType(param)
                    };
                })
            };
        });

        return methods;
    }

    getGettersForDeclaration(declaration) {
        const getters = (declaration.members || []).filter(member => member.kind === "field" && member.readonly && !member.inheritedFrom).map(getter => {
            const functionName = "get" + getter.name.substr(0, 1).toUpperCase() + getter.name.substr(1);
            let description;
            if (getter.description.match(/^returns/i)) {
                description = getter.description; // The getter text already says "Returns... something"
            } else { // The getter text directly starts with the noun
                description = "Returns the " + getter.description.substr(0, 1).toLowerCase() + getter.description.substr(1);
            }

            return {
                name: getter.name,
                functionName,
                description: this.constructor.replaceTagsWithFullNames(description)
            };
        });

        return getters;
    }

    static all;

    static tagToNameMap;

    static config;

    static getVersion = name => {
        return (this.config.versions || {})[name] || "1.92.0";
    }

    static getParentPackage(declaration) {
        const superclass = declaration.superclass;
        if (!superclass || superclass.name === "UI5Element") {
            return;
        }

        const superclassPackage = this.all.get(superclass.package);
        if (!superclassPackage) {
            console.log("Cound not find package for superclass", superclass);
            return;
        }

        return superclassPackage;
    }

    static isAssociationProperty(member) {
        return this.hasAssociationLikeDescription(member) || this.associationProperties[member.name];
    }

    static hasAssociationLikeDescription(member) {
        const desc = member.description?.toLowerCase();
        return desc?.includes("id of") || desc?.includes("id or dom");
    }

    static get associationProperties() {
        return {
            for: {
                name: "labelFor",
                description: `Association to the labelled control.\n<br>\nBy default, the label sets the for attribute to the ID of the labelled control. This can be changed by implementing the function getIdForLabel on the labelled control.`, // prop.description,
                type: "sap.ui.core.Control",
                multiple: false
            },
            accessibleNameRef: {
                name: "ariaLabelledBy",
                description: `Receives id(or many ids) of the controls that label this control.`, // prop.description,
                type: "sap.ui.core.Control",
                multiple: true,
                formatter: "_getAriaLabelledByForRendering"
            }
        };
    }

    static isTextSlot(slot) {
        return slot._ui5type.text.includes("Node") && slot.description.includes("use text in order to preserve the intended design");
    }

    static getTypeAndDefault(propertyData) {
        const typeData = propertyData.type;
        const typeText = typeData.text.split("|")[0].trim(); // f.e. "string | undefined | null" -> "string"
        const defaultValue = propertyData.default;
        const validator = propertyData._ui5validator;

        // boolean
        if (typeText === "boolean") {
            return {
                type: "boolean",
                defaultValue: "false"
            };
        }

        // string
        if (typeText === "string") {
            if (validator === "CSSColor") {
                return {
                    type: "sap.ui.core.CSSColor",
                    defaultValue
                };
            }

            if (validator === "CSSSize") {
                return {
                    type: "sap.ui.core.CSSSize",
                    defaultValue
                };
            }

            return {
                type: "string",
                defaultValue: defaultValue !== "" ? defaultValue : undefined
            };
        }

        // int
        if (validator === "Integer") {
            return {
                type: "int",
                defaultValue
            };
        }

        // float
        if (validator === "Float") {
            return {
                type: "float",
                defaultValue
            };
        }

        // object
        if (validator === "Object") {
            return {
                type: "object",
                defaultValue
            };
        }

        // enum
        if (typeData.references) {
            const enumData = typeData.references[0];
            const enumPackage = this.all.get(enumData.package);

            const enumName = enumData.name;
            const enumNamespace = [
                "CalendarType",
                "ValueState"
            ].includes(enumName)
? "sap.ui.core"
: enumPackage.namespace;

            const fullEnumName = `${enumNamespace}.${enumName}`;

            return {
                type: fullEnumName,
                defaultValue: defaultValue ? `${enumName}.${defaultValue.replace(/"/g, "")}` : undefined,
                enumName: fullEnumName,
                library: enumNamespace
            };
        }

        // unknown
        return {
            type: typeText,
            defaultValue
        };
    }

    static getParameterType(parameterData) {
        const typeData = parameterData.type;
        const typeText = typeData.text.split("|")[0].trim(); // f.e. "string | undefined | null" -> "string"

        // boolean
        if (typeText === "Boolean") {
            return "boolean";
        }

        // string
        if (typeText === "String") {
            return "string";
        }

        // int
        if (typeText === "Integer") {
            return "int";
        }

        // float
        if (typeText === "Float") {
            return "float";
        }

        // object
        if (typeText === "Object") {
            return "object";
        }

        // array
        if (typeText === "Array") {
            return "array";
        }

        // enum
        if (typeData.references) {
            const enumData = typeData.references[0];
            const enumPackage = this.all.get(enumData.package);

            const enumName = enumData.name;
            const enumNamespace = [
                "CalendarType",
                "ValueState",
                "CSSSize",
                "CSSColor"
            ].includes(enumName)
? "sap.ui.core"
: enumPackage.namespace;

            const fullEnumName = `${enumNamespace}.${enumName}`;
            return fullEnumName;
        }

        // unknown
        return typeText;
    }

    static getAggregationType(slotData) {
        const typeData = slotData._ui5type;

        if (!typeData.references) {
            return "sap.ui.core.Control";
        }

        const interfaceData = typeData.references[0];
        const interfacePackage = this.all.get(interfaceData.package);
        const interfaceNamespace = interfacePackage.namespace;
        const interfaceName = interfaceData.name;
        return `${interfaceNamespace}.${interfaceName}`;
    }

    static replaceTagsWithFullNames(string) {
        if (string === undefined) {
            return string;
        }
        return string.replace(/<code>(ui5-.*?)<\/code>/g, (match, contents) => {
            const fullName = this.tagToNameMap.get(contents);
            return `<code>${fullName || contents}</code>`;
        });
    }
}

module.exports = ComponentsPackage;
