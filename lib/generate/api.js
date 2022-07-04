const fs = require("fs");

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

	let parentComponent = getComponentByName(component.extends, entries);
	if (parentComponent) {
		calculateAPI(parentComponent, entries, calculated);
		entities.forEach(entity => {
			parentComponent[entity].forEach( x => {
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

const getAPI = (apiFile, config) => {
	let fileText = fs.readFileSync(apiFile);

    for (const jsDocNamespace in config.jsDocNamespaces) {
        const newNamespace = config.jsDocNamespaces[jsDocNamespace];
        const reg = new RegExp(escapeRegex(jsDocNamespace), "g");
        fileText = `${fileText}`.replace(reg, newNamespace);
    }


	const api = JSON.parse(fileText);

	const entries = api['symbols'];
	const calculated = [];
	entries.forEach(entry => {
		calculateAPI(entry, entries, calculated);
	});
	return entries;
};

module.exports = getAPI;
