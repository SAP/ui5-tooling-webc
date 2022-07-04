const normalizeLibraryName = (fullName) => {
	fullName = fullName.replace(".types.", ".");
	return fullName;
};

module.exports = normalizeLibraryName;
