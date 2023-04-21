const url = require('url');
const {STRINGS, SLASH, PROTOCOL_REGEXP, HTTP, HTTPS, HTTP_PORT, HTTPS_PORT} = require('../lib/constants');

/**
 * @param ipStringWithPort
 * @returns {{host: string, port: number, protocol: string, [credentials]: string}}
 */
function getAddressAndPortFromString(ipStringWithPort) {
    if (!PROTOCOL_REGEXP.test(ipStringWithPort)) {
        ipStringWithPort = STRINGS.PLACEHOLDER_PROTOCOL + SLASH + SLASH + ipStringWithPort;
    }

    let {protocol, hostname, port, auth} = url.parse(ipStringWithPort);
    if (protocol === STRINGS.PLACEHOLDER_PROTOCOL) {
        protocol = (port && parseInt(port) === HTTPS_PORT)
            ? HTTPS
            : HTTP;
    }

    port = port || (protocol && ~protocol.indexOf(HTTPS)
        ? HTTPS_PORT
        : HTTP_PORT);

    const infoSession = {
        host: hostname,
        port: parseInt(port),
        protocol: protocol.replace(STRINGS.SEPARATOR, STRINGS.EMPTY),
        // credentials: auth || undefined
    };

    if (auth) {
        infoSession.credentials = auth;
    }

    return infoSession;
}

/**
 * Build options for native nodejs tcp-connection.
 * @param proxyToUse
 * @param upstreamHost
 * @returns {boolean|{host: string, port: number, protocol: string, [credentials]: string, upstreamed:boolean}}
 */
module.exports = function getConnectionOptions(proxyToUse, upstreamHost) {
    const isValid = require('../lib/isValidASCII');
    if (isValid(upstreamHost)) {
        const upstreamed = !!proxyToUse;
        const upstreamToUse = (upstreamed)
            ? proxyToUse
            : upstreamHost;
        const config = getAddressAndPortFromString(upstreamToUse);
        const objectToReturn = Object.assign({}, config, {upstreamed: upstreamed});
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
