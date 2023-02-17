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

const getPackagePath = async packageName => {
    // Try to directly find the path to the package.json (always works unless denied by exports)
    try {
        return path.dirname(require.resolve(path.join(packageName, "package.json")));
    } catch (e) {}

    // Start where the module index is, and go up one level until package.json is found
    let dir = path.dirname(require.resolve(packageName));
    while (!(await fileExists(path.join(dir, "package.json")))) {
        dir = path.join(dir, "../");
        if (dir === path.sep) {
            throw new Error(`Could not resolve path for: ${packageName}`);
        }
    }

    return dir;
}

module.exports = getPackagePath;
