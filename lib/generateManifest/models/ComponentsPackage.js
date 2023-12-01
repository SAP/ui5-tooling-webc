class ComponentsPackage {
    constructor(name, settings, config) {
        this.name = name;
        this.namespace = settings.namespace;
        this.manifest = settings.manifest;
        this.parseManifest();
        this.createDesignTimeData();
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
                }
                else if (declaration.kind === "enum") {
                    this.createEnum(declaration);
                }
                else if (declaration.kind === "class" && declaration.tagName) {
                    this.createControl(declaration);
                }
            });
        });
    }

    createInterface(declaration) {
        const name = `${this.namespace}.${declaration.name}`;
        this.interfaces.push({
            name: name,
            description: this._formatDescription(declaration.description),
            version: this.constructor.getVersion(name)
        });
    }

    createEnum(declaration) {
        const name = `${this.namespace}.${declaration.name}`;
        this.enums.push({
            name: name,
            basename: declaration.name,
            description: this._formatDescription(declaration.description),
            version: this.constructor.getVersion(name),
            properties: declaration.members.map(member => {
                return {
                    name: member.name,
                    description: this._formatDescription(member.description)
                }
            })
        });
    }

    createControl(declaration) {
        const name = `${this.namespace}.${declaration.name}`;
        if (this.constructor.config?.noControl?.includes(name)) {
            return;
        }

        const control = {
            name: name,
            description: this._formatDescription(declaration.description),
            version: this.constructor.getVersion(name)
        };
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

    _formatDescription(text) {
        if (!text) {
            return "";
        }

        return text.replace(/\n/g, "\n* ");
    }

    static all = [];

    static config;

    static getVersion = name => {
        return (this.config.versions || {})[name] || "1.92.0";
    }

    static typesMap = {

    }

}

module.exports = ComponentsPackage;
