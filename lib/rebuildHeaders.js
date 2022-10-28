const {STRINGS} = require('./constants');
const {BLANK, CRLF, SEPARATOR} = STRINGS;
const DOUBLE_CRLF = CRLF + CRLF;

/**
 *
 * @param {Object} headersObject
 * @param {buffer} dataBuffer
 * @returns {buffer}
 */
module.exports = function rebuildHeaders(headersObject, dataBuffer) {
    const dataString = dataBuffer.toString();
    const [headers, body] = dataString.split(DOUBLE_CRLF + CRLF, 2);
    const firstRow = headers.split(CRLF, 1)[0];

    let newData = firstRow + CRLF;

    for (const key of Object.keys(headersObject)) {
        const value = headersObject[key];
        newData += key + SEPARATOR + BLANK + value + CRLF;
    }

    newData += DOUBLE_CRLF + (body || '');

    return Buffer.from(newData);
};
