const transpile = require("./transpile");

transpile().then(() => {
    console.log(`Prebuild successful.`);
});
