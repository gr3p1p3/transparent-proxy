const {STRINGS} = require('./constants');
const {BLANK, CLRF, EMPTY, SEPARATOR} = STRINGS;

module.exports = function parseHeaders(headersObject, dataBuffer) {
    //TODO make secure
    const dataString = dataBuffer.toString();
    const [headers, body] = dataString.split(CLRF + CLRF + CLRF);
    const firstRow = headers.split(CLRF)[0];

    let newData = firstRow + CLRF;

    for (const key of Object.keys(headersObject)) {
        const value = headersObject[key];
        newData += key + SEPARATOR + BLANK + value + CLRF;
    }

    newData += CLRF + CLRF + (body || '');

    return newData;
};
