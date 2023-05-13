const {STRINGS} = require('./constants');
const {BLANK, CRLF, LF, SEPARATOR} = STRINGS;

/**
 *
 * @param {buffer} data
 * @param {boolean} isResponse - Is a ResponseMessage.
 * @param {boolean} chunked - Is response chunked.
 * @returns {Object} HTTP-Message - {method,path,version,headers:{},body}
 */
module.exports = function parseDataToObject(data, isResponse = false, chunked = false) {
    //TODO make secure
    const DOUBLE_CRLF = CRLF + CRLF;
    const splitAt = data.indexOf(DOUBLE_CRLF); //TODO split at LF and delete CR after instead doing this
    const infoObject = {}; //need to be empty for validation in HTTPMessage.parseData

    if (!chunked) {
        let [headers, body] = [data.slice(0, splitAt), data.slice(splitAt + DOUBLE_CRLF.length)];
        const headerRows = headers.toString().split(CRLF, 50); //TODO use slice instead doing this

        for (let i = 0; i < headerRows.length; i++) {
            const headerRow = headerRows[i];
            if (i === 0) {   //first row contain method, path and type
                const firstSplitIndex = headerRow.indexOf(BLANK);
                const [method, pathWithVersion] = [headerRow.slice(0, firstSplitIndex), headerRow.slice(firstSplitIndex + 1)];
                const secondSplitIndex = pathWithVersion.indexOf(BLANK);
                const [path, version] = [pathWithVersion.slice(0, secondSplitIndex), pathWithVersion.slice(secondSplitIndex + 1)];
                if (isResponse) {
                    infoObject.version = method.toString();
                    infoObject.statusCode = parseInt(path.toString());
                    infoObject.statusText = version.toString();
                }
                else {
                    infoObject.method = method.toString();
                    infoObject.path = path.toString();
                    infoObject.version = version.toString();
                }
            }
            else {
                infoObject.headers = infoObject.headers || {};
                const splitIndexRow = headerRow.indexOf(SEPARATOR);
                const [attribute, value] = [headerRow.slice(0, splitIndexRow), headerRow.slice(splitIndexRow + 1)];
                if (attribute && value) {
                    const lowerAttribute = attribute.toString().trim().toLowerCase();
                    if (!infoObject.headers[lowerAttribute]) {
                        infoObject.headers[lowerAttribute] = value.toString().trim();
                    }
                    else {
                        infoObject.headers[lowerAttribute] += ', ' + value.trim()
                    }
                }
            }
        }

        if (body) {
            infoObject.body = body.toString();
        }
    }
    else {
        // data is only the chunked body
        infoObject.body = data.toString();
    }

    return infoObject;
};
