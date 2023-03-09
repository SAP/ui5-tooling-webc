const normalizeType = (type) => {
    if (type === "String") {
        return "string";
    }

    if (type === "Boolean") {
        return "boolean";
    }

    if (type === "Object" || type === "File") {
        return "object";
    }

    if (type === "sap.ui.webc.base.Integer" || type === "Integer") {
        return "int";
    }

    if (type === "sap.ui.webc.base.Float" || type === "Float") {
        return "float";
    }

    if (type === "sap.ui.webc.base.ValueState" || type === "ValueState") {
        return "sap.ui.core.ValueState";
    }

    if (type === "sap.ui.webc.base.CSSColor" || type === "CSSColor") {
        return "sap.ui.core.CSSColor";
    }

    if (type === "sap.ui.webc.base.CalendarType" || type === "CalendarType") {
        return "sap.ui.core.CalendarType";
    }

    return type;
};

module.exports = normalizeType;
