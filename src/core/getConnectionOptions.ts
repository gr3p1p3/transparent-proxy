import url  from 'url';
import {isAscii, CONSTANTS} from '../lib'
const {STRINGS, SLASH, PROTOCOL_REGEXP, HTTP, HTTPS, HTTP_PORT, HTTPS_PORT} = CONSTANTS

/**
 * @param ipStringWithPort
 * @returns {{host: string, port: number, protocol: string, credentials: string}}
 */
function getAddressAndPortFromString(ipStringWithPort: string) {
    if (!PROTOCOL_REGEXP.test(ipStringWithPort)) {
        ipStringWithPort = STRINGS.PLACEHOLDER_PROTOCOL + SLASH + SLASH + ipStringWithPort;
    }

    let {protocol, hostname, port, auth} = url.parse(ipStringWithPort);
    if (protocol === STRINGS.PLACEHOLDER_PROTOCOL) {
        protocol = (port && port === HTTPS_PORT.toString())
            ? HTTPS
            : HTTP;
    }

    port = port || (protocol && ~protocol.indexOf(HTTPS)
        ? HTTPS_PORT.toString()
        : HTTP_PORT.toString());

    return JSON.parse(JSON.stringify({
        host: hostname,
        port: parseInt(port),
        protocol: protocol?.replace(STRINGS.SEPARATOR, STRINGS.EMPTY),
        credentials: auth || undefined
    }));
}

/**
 * Build options for native nodejs tcp-connection.
 * @param proxyToUse
 * @param upstreamHost
 * @returns {boolean|{host: string, port: number, protocol: string, credentials: string, upstreamed:boolean}}
 */
export function getConnectionOptions(proxyToUse: string | false, upstreamHost: string) {
    if (isAscii(upstreamHost)) {
        const upstreamed = !!proxyToUse;
        const upstreamToUse = (upstreamed)
            ? proxyToUse
            : upstreamHost;
        const config = getAddressAndPortFromString(upstreamToUse);
        const objectToReturn = {...config, ...{upstreamed: upstreamed}};
        if (objectToReturn.upstreamed) {
            objectToReturn.upstream = getAddressAndPortFromString(upstreamHost);
        }
        if (!(objectToReturn.port >= 0 && objectToReturn.port < 65536)) {
            return false;
        }
        return objectToReturn;
    }
    else {
        return false;
    }
};
