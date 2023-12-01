class ComponentsPackage {
    constructor(name, settings) {
        this.name = name;
        this.namespace = settings.namespace;
        this.manifest = settings.manifest;
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

module.exports = ComponentsPackage;
