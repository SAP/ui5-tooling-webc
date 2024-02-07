const path = require("path");
const fs = require("fs");

function resolvePackageJson(dep, paths) {
  let packageJsonPath;
  try {
    packageJsonPath = path.dirname(require.resolve(path.join(dep, "package.json"), { paths }));
  } catch (e) {
    // for packages we resolve via their name, we need to lookup the package.json (since it returns the index module path)
    packageJsonPath = path.dirname(require.resolve(path.join(dep), { paths }));
    while (packageJsonPath && !fs.existsSync(path.join(packageJsonPath, "package.json"))) {
      packageJsonPath = path.resolve(packageJsonPath, "..");
    }
  }
  return packageJsonPath;
}

const getPackagePath = async (packageName) => {
  const pkgJson = require(path.join(process.cwd(), "package.json"));
  // maybe we should also include devDependencies? Right now, the dependencies should be sufficient!
  const paths = Object.keys(pkgJson.dependencies || []).map((dep) => resolvePackageJson(dep));
  return resolvePackageJson(packageName, [process.cwd(), ...paths])
};

module.exports = getPackagePath;
