const {STRINGS} = require('./constants');
const {BLANK, CLRF, SEPARATOR} = STRINGS;

module.exports = function parseHeaders(data) {
    //TODO make secure
    const dataString = data.toString();
    const [headers, body] = dataString.split(CLRF + CLRF, 2);
    const headerRows = headers.split(CLRF, 50);
    const infoObject = {};
    for (let i = 0; i < headerRows.length; i++) {
        const headerRow = headerRows[i];
        if (i === 0) {   //first row contain method, path and type
            const [method, path, version] = headerRow.split(BLANK, 3);
            infoObject.method = method;
            infoObject.path = path;
            infoObject.version = version;
        }
        else {
            infoObject.headers = infoObject.headers || {};
            const splitIndexRow = headerRow.indexOf(SEPARATOR);
            const [attribute, value] = [headerRow.slice(0, splitIndexRow), headerRow.slice(splitIndexRow + 1)];
            if (attribute && value) {
                const lowerAttribute = attribute.trim().toLowerCase();
                infoObject.headers[lowerAttribute] = value.trim();
            }
        }
    }
    if (body) {
        infoObject.body = body;
    }
    return infoObject;
};
