const beautify = require('js-beautify').js;

const beautifyJS = control => {
    control = beautify(control, {
        indent_char: "\t",
        indent_size: 1
    });

    // remove trailing whitespaces
    control = control.replace(/[\t ]+\n/g, `\n`);

    // remove trailing commas
    control = control.replace(/,(\s+[}\]])/g, "$1");

    return control;
};

module.exports = beautifyJS;
