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
}

module.exports = BuilderBase;
