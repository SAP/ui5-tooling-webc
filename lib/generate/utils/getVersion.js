const getVersion = (config, name) => {
    return (config.versions || {})[name] || "1.92.0";
}

module.exports = getVersion;
