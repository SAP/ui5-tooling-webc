class Library {
    constructor(name, manifest) {
        this.name = name;
        this.manifest = manifest;
        this.parse();
    }

    parse() {
        this._controls = [];
        this._types = [];
        this._interfaces = [];
        this.manifest.modules.forEach(module => {
            module.declarations.forEach(declaration => {
                if (declaration._ui5privacy === "private") {
                    return;
                }

                if (declaration.kind === "interface") {
                    console.log(declaration)
                }
            });
        });
    }
}

module.exports = Library;
