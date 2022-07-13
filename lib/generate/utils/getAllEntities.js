const getComponentByName = (name, entries) => {
    return entries.find(element => {
        return element.basename === name;
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

const getAPI = (fileText, jsDocNamespaces = {}) => {
    // fix 1: replace f.e. sap.ui.webcomponents.main -> sap.ui.webc.main
    // This is only relevant for OpenUI5 stock libraries (legacy namespaces used in the components JSDoc) and not for third-party libraries
    for (const jsDocNamespace in jsDocNamespaces) {
        const newNamespace = jsDocNamespaces[jsDocNamespace];
        const reg = new RegExp(escapeRegex(jsDocNamespace), "g");
        fileText = `${fileText}`.replace(reg, newNamespace);
    }

    const api = JSON.parse(fileText);
    const entries = api.symbols;

    // fix 2: replace sap.ui.webc.main.types.AvatarSize -> sap.ui.webc.main.AvatarSize
    // This is a fix for all types - fix the namespace to not include ".types"
    entries.forEach(entry => {
       entry.name = entry.name.replace(/\.types\./g, ".");
    });

    const calculated = [];
    entries.forEach(entry => {
        calculateAPI(entry, entries, calculated);
    });
    return entries;
};

const getAllEntities = (apiFiles, jsDocNamespaces) => {
    let allEntities = [];
    apiFiles.forEach(apiFile => {
        const api = getAPI(apiFile, jsDocNamespaces);
        allEntities = [...allEntities, ...api];
    });
    return allEntities;
}

module.exports = getAllEntities;
