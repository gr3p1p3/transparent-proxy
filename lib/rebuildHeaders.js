const {STRINGS} = require('./constants');
const {BLANK, CLRF, SEPARATOR} = STRINGS;
const DOUBLE_CLRF = CLRF + CLRF;

/**
 *
 * @param {Object} headersObject
 * @param {Buffer} dataBuffer
 * @returns {Buffer}
 */
module.exports = function rebuildHeaders(headersObject, dataBuffer) {
    //TODO make secure
    const dataString = dataBuffer.toString();
    const [headers, body] = dataString.split(DOUBLE_CLRF + CLRF);
    const firstRow = headers.split(CLRF)[0];

    let newData = firstRow + CLRF;

    for (const key of Object.keys(headersObject)) {
        const value = headersObject[key];
        newData += key + SEPARATOR + BLANK + value + CLRF;
    }

    newData += DOUBLE_CLRF + (body || '');

    return Buffer.from(newData);
};
