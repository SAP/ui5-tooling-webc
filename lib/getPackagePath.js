const path = require("path");

const getPackagePath = async (packageName) => {
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
};

module.exports = getPackagePath;
