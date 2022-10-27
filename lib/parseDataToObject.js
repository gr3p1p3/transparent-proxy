const {STRINGS} = require('./constants');
const {BLANK, CLRF, SEPARATOR} = STRINGS;

/**
 *
 * @param data
 * @param isResponse - Is a ResponseMessage.
 * @param chunked - Is response chunked.
 * @returns {Object} HTTP-Message - {method,path,version,headers:{},body}
 */
module.exports = function parseDataToObject(data, isResponse = false, chunked = false) {
    //TODO make secure
    const dataString = data.toString();
    const splitAt = dataString.indexOf(CLRF + CLRF);
    const [headers, body] = [dataString.slice(0, splitAt), dataString.slice(splitAt + 1)];
    const headerRows = headers.split(CLRF, 50);
    const infoObject = {};
    for (let i = 0; i < headerRows.length; i++) {
        const headerRow = headerRows[i];
        if (i === 0) {   //first row contain method, path and type
            const firstSplitIndex = headerRow.indexOf(BLANK);
            const [method, pathWithVersion] = [headerRow.slice(0, firstSplitIndex), headerRow.slice(firstSplitIndex + 1)];
            const secondSplitIndex = pathWithVersion.indexOf(BLANK);
            const [path, version] = [pathWithVersion.slice(0, secondSplitIndex), pathWithVersion.slice(secondSplitIndex + 1)];
            if (isResponse) {
                if (!chunked) {
                    infoObject.version = method;
                    infoObject.statusCode = path;
                    infoObject.statusText = version;
                }
                else {
                    infoObject.body = dataString;
                }
            }
            else {
                infoObject.method = method;
                infoObject.path = path;
                infoObject.version = version;
            }
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
