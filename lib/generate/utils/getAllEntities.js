const getComponentByName = (name, entries) => {
    return entries.find(element => {
        return element.name === name || element.basename === name;
    })
};

const componentHasEntityItem = (component, entity, name) => {
    return component[entity].some(x => x && x.name === name);
};

const removeEmpty = arr => arr.filter(x => x);

const calculateAPI = (component, entries, calculated) => {
    if (calculated.indexOf(component.basename) !== -1) {
        return component;
    }
    const entities = ["properties", "slots", "events", "methods"];

    // Initialize all entities with [] if necessary, and remove undefined things, and only leave public things
    entities.forEach(entity => {
        component[entity] = removeEmpty(component[entity] || []).filter(x => x.visibility === "public");
    });

    const parentComponent = getComponentByName(component.extends, entries);
    if (parentComponent) {
        calculateAPI(parentComponent, entries, calculated);
        entities.forEach(entity => {
            parentComponent[entity].forEach(x => {
                if (!componentHasEntityItem(component, entity, x.name)) {
                    component[entity].push(x);
                }
            });
        });
    }

    calculated.push(component.basename);
};

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const getAPI = (fileText, replaceJSDocNamespaces = {}) => {
    // This is a temporary fix and can be deleted once OpenUI5 is updated to a newer UI5 Web Components runtime
    replaceJSDocNamespaces["sap.ui.webc.base.types"] = "sap.ui.webc.base";
    replaceJSDocNamespaces["sap.ui.webc.main.types"] = "sap.ui.webc.main";
    replaceJSDocNamespaces["sap.ui.webc.fiori.types"] = "sap.ui.webc.fiori";
    replaceJSDocNamespaces["sap.ui.webcomponents.base.types"] = "sap.ui.webc.base";
    replaceJSDocNamespaces["sap.ui.webcomponents.main.types"] = "sap.ui.webc.main";
    replaceJSDocNamespaces["sap.ui.webcomponents.fiori.types"] = "sap.ui.webc.fiori";
    replaceJSDocNamespaces["sap.ui.webcomponents.base"] = "sap.ui.webc.base";
    replaceJSDocNamespaces["sap.ui.webcomponents.main"] = "sap.ui.webc.main";
    replaceJSDocNamespaces["sap.ui.webcomponents.fiori"] = "sap.ui.webc.fiori";

    // This is only relevant for OpenUI5 stock libraries (legacy namespaces used in the components JSDoc) and not for third-party libraries
    for (const jsDocNamespace in replaceJSDocNamespaces) {
        const newNamespace = replaceJSDocNamespaces[jsDocNamespace];
        const reg = new RegExp(escapeRegex(jsDocNamespace), "g");
        fileText = `${fileText}`.replace(reg, newNamespace);
    }

    const api = JSON.parse(fileText);
    const entries = api.symbols;

    const calculated = [];
    entries.forEach(entry => {
        calculateAPI(entry, entries, calculated);
    });
    return entries;
};

const getAllEntities = (apiFiles, replaceJSDocNamespaces) => {
    let allEntities = [];
    apiFiles.forEach(apiFile => {
        const api = getAPI(apiFile, replaceJSDocNamespaces);
        allEntities = [...allEntities, ...api];
    });
    return allEntities;
}

module.exports = getAllEntities;
