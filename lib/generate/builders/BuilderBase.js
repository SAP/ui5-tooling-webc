class BuilderBase {
    constructor(config, library, allEntities) {
        this.config = config;
        this.library = library;
        this.allEntities = allEntities;
        this.libraryEntities = allEntities.filter(entity => this.belongsToLibrary(entity));
    }

    belongsToLibrary(entry) {
        return entry.name.startsWith(this.library);
    }

    // This is needed for test pages that use buttons - if the button is not a dependency, it can't be used
    hasWebcMainButton() {
        return this.allEntities.some(entity => entity.name === "sap.ui.webc.main.Button");
    }
}

module.exports = BuilderBase;
