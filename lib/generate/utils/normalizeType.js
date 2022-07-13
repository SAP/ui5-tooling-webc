const normalizeType = (type) => {
    if (type === "String") {
        return "string";
    }

    if (type === "Integer") {
        return "int";
    }

    if (type === "Boolean") {
        return "boolean";
    }

    if (type === "Float") {
        return "float";
    }

    if (type === "Object" || type === "File") {
        return "object";
    }

    if (type === "ValueState") {
        return "sap.ui.core.ValueState";
    }

    if (type === "CSSSize") {
        return "sap.ui.core.CSSSize";
    }

    if (type === "CSSColor") {
        return "sap.ui.core.CSSColor";
    }

    if (type === "CalendarType") {
        return "sap.ui.core.CalendarType";
    }

    return type;
};

module.exports = normalizeType;
