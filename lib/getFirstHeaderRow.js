const {STRINGS} = require('./constants');
const {CRLF} = STRINGS;

/**
 * @param {buffer} data
 * @returns {buffer}
 */
module.exports = function getFirstHeaderRow(buffer) {
  return buffer.subarray(0, buffer.indexOf(CRLF));
};
