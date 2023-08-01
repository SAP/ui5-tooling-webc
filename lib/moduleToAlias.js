// helper function to resolve a modulePath to an aliasPath
const moduleToAlias = (modulePath, aliases) => {
    let resolvedPath = modulePath;

    for (const i in aliases) {
        resolvedPath = resolvedPath.replace(new RegExp(i), aliases[i]);
    }
    return resolvedPath;
}

module.exports = moduleToAlias;
