import { CONSTANTS } from ".";
import { HttpMessage } from "../types";
const { BLANK, CRLF, SEPARATOR } = CONSTANTS.STRINGS;

/**
 *
 * @param data
 * @param isResponse - Is a ResponseMessage.
 * @param chunked - Is response chunked.
 * @returns {Object} HTTP-Message - {method,path,version,headers:{},body}
 */
export function parseDataToObject(
  data: any,
  isResponse = false,
  chunked = false
): HttpMessage {
  //TODO make secure
  const dataString = data.toString();
  const splitAt = dataString.indexOf(CRLF + CRLF);
  const infoObject: any = {};

  if (!chunked) {
    const [headers, body] = [
      dataString.slice(0, splitAt),
      dataString.slice(splitAt + 1),
    ];
    const headerRows = headers.split(CRLF, 50);

    for (let i = 0; i < headerRows.length; i++) {
      const headerRow = headerRows[i];
      if (i === 0) {
        //first row contain method, path and type
        const firstSplitIndex = headerRow.indexOf(BLANK);
        const [method, pathWithVersion] = [
          headerRow.slice(0, firstSplitIndex),
          headerRow.slice(firstSplitIndex + 1),
        ];
        const secondSplitIndex = pathWithVersion.indexOf(BLANK);
        const [path, version] = [
          pathWithVersion.slice(0, secondSplitIndex),
          pathWithVersion.slice(secondSplitIndex + 1),
        ];
        if (isResponse) {
          infoObject.version = method;
          infoObject.statusCode = path;
          infoObject.statusText = version;
        } else {
          infoObject.method = method;
          infoObject.path = path;
          infoObject.version = version;
        }
      } else {
        infoObject.headers = infoObject.headers || {};
        const splitIndexRow = headerRow.indexOf(SEPARATOR);
        const [attribute, value] = [
          headerRow.slice(0, splitIndexRow),
          headerRow.slice(splitIndexRow + 1),
        ];
        if (attribute && value) {
          const lowerAttribute = attribute.trim().toLowerCase();
          infoObject.headers[lowerAttribute] = value.trim();
        }
      }
    }
    if (body) {
      infoObject.body = body;
    }
  } else {
    // data is only the chunked body
    infoObject.body = dataString;
  }

  return infoObject;
}
