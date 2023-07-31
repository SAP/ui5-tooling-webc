const espree = require("espree");
const estraverse = require("estraverse");
const escodegen = require("escodegen");
const path = require("path");
const moduleToAlias = require("./moduleToAlias");

/**
 *
 * @param moduleCode String with the content of the file
 * @param moduleName f.e. /dev/proj/node_modules/@ui5/webcomponents/base/dist/UI5Element.js
 * @param aliases f.e.
 * @returns {void|string|*}
 */
const wrapDependencies = (moduleCode, moduleName, aliases, cyclicDependencies) => {
    // Get the absolute path of the module
    if (!moduleName.includes("node_modules/")) {
        return moduleCode;
    }
    const nodeModulesPath = moduleName.split("node_modules/")[1];
    const resolvedModulePath = moduleToAlias(nodeModulesPath, aliases);
    if (resolvedModulePath === nodeModulesPath) {
        return moduleCode;
    }

    if (!(resolvedModulePath in cyclicDependencies)) {
        return moduleCode;
    }

    const ast = espree.parse(moduleCode, { range: true, ecmaVersion: "latest" });

    // Find the dependencies and their respective modules
    const modules = []; // all modules paths (except for the first: "exports")
    let depsLastIndex; // index where the "define" function parameters end
    const deps = []; // all dependencies (except for the first: _exports)
    estraverse.traverse(ast, {
        enter: (node, parent) => {
            // find modules
            if (node.type === "ArrayExpression" && node.elements.length && node.elements[0].raw === `"exports"`) {
                node.elements.slice(1).forEach(elem => {
                    modules.push(elem.value);
                });
                // find dependencies
            } else if (node.type === "FunctionExpression" && node.params.length && node.params[0].name === "_exports") {
                depsLastIndex = node.params[node.params.length - 1].range[1];
                node.params.slice(1).forEach(param => {
                    deps.push(param.name);
                });
            }
        }
    });

    // Module with no dependencies - do nothing
    if (deps.length === 0 || modules.length === 0 || deps.length !== modules.length) {
        return moduleCode;
    }

    // Map all dependencies to their modules' paths
    const depsToModulesMap = new Map();
    deps.forEach((dep, i) => {
        const module = modules[i];
        const fullPath = module.startsWith(".") ? path.join(resolvedModulePath, "../", module) : module;
        if (cyclicDependencies[resolvedModulePath].includes(fullPath)) {
            depsToModulesMap.set(dep, fullPath);
        }
    });

    moduleCode = estraverse.replace(ast, {
        enter: (node, parent) => {
            if (node.type === "Identifier") {
                // Only replace identifiers after the define function arguments
                if (depsToModulesMap.has(node.name) && node.range[0] > depsLastIndex) {
                    // skip usage as a member (f.e. x._Popover)
                    if (parent.type === "MemberExpression" && parent.property.name === node.name) {
                        return;
                    }

                    // skip usage as an object key (f.e. x = { _Popover: 1 })
                    if (parent.type === "Property" && parent.key.name === node.name) {
                        return;
                    }

                    // skip var declarations (f.e. const _Popover = 1;)
                    if (parent.type === "VariableDeclarator" && parent.id.name === node.name) {
                        return;
                    }

                    // skip var declarations (f.e. const _Popover = 1;)
                    if (parent.type === "AssignmentExpression" && parent.left.name === node.name) {
                        return;
                    }

                    const moduleName = depsToModulesMap.get(node.name);
                    const newStr = `sap.ui.require("${moduleName}")`;
                    const newCode = espree.parse(newStr, { ecmaVersion: "latest" });
                    return newCode.body[0].expression;
                }
            }
        }
    });

    return escodegen.generate(moduleCode);
};

module.exports = wrapDependencies;
