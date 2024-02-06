const path = require("path");
const fs = require("fs").promises;

const fileExists = async file => {
    try {
        await fs.stat(file);
    } catch (e) {
        return false;
    }
    return true;
}

const getPackagePath = async (packageName) => {
    // Try to find the path to package.json by directly calling require.resolve (always works unless denied by exports)
    try {
        const pkgJson = require(path.join(process.cwd(), "package.json"));
        // maybe we should also include devDependencies? Right now, the dependencies should be sufficient!
        const paths = Object.keys(pkgJson.dependencies || []).map((dep) =>
            path.dirname(require.resolve(path.join(dep, "package.json")))
        );
        return path.dirname(
            require.resolve(path.join(packageName, "package.json"), {
                paths: [process.cwd(), ...paths]
            })
        );
    } catch (e) {}

    // package.json is denied by exports - start where the module index is, and go up one level until package.json is found
    let dir = path.dirname(require.resolve(packageName));
    while (!(await fileExists(path.join(dir, "package.json")))) {
        dir = path.join(dir, "../");
        if (dir === path.sep) {
            throw new Error(`Could not resolve path for: ${packageName}`);
        }
    }

    return dir;
};

module.exports = getPackagePath;
