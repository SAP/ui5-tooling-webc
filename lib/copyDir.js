const fs = require("fs").promises;
const path = require("path");

const copyDir = async (src, dest) => {
    const entries = await fs.readdir(src, { withFileTypes: true });
    await fs.mkdir(dest);
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
};

module.exports = copyDir;
