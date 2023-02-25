const getFirstHeaderRow = require('./getFirstHeaderRow');

/**
 * @param {string} method
 * @param {buffer} data
 * @returns {boolean}
 */
module.exports = function isRequestOfMethodType(method, buffer) {
  return getFirstHeaderRow(buffer).indexOf(method) > -1;
};
