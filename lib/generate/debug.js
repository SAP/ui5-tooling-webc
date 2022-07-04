const allPropertyTypes = new Set();

const registerType = type => {
	allPropertyTypes.add(type);
};

const getAllRegisteredPropertyTypes = () => [...allPropertyTypes.values()].sort();

module.exports = {
	registerType,
	getAllRegisteredPropertyTypes,
};
