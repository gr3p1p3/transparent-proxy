const {STRINGS, SLASH, SLASH_REGEXP, SLASH_REGEXP_ONCE, HTTP, HTTPS, HTTP_PORT, HTTPS_PORT} = require('../lib/constants');

/**
 *
 * @param ipStringWithPort
 * @returns {{host: string, port: number, protocol: string, credentials: string}}
 */
function getAddressAndPortFromString(ipStringWithPort) {
    let [credentials, targetHost] = ipStringWithPort.split(STRINGS.AT);

    if (!targetHost) {
        targetHost = credentials;
        credentials = '';
    }

    let [protocol, host, port] = targetHost.split(STRINGS.SEPARATOR);
    if (protocol.indexOf(HTTP) === -1) {
        port = host;
        host = protocol;
        protocol = (port && parseInt(port) === HTTPS_PORT)
            ? HTTPS
            : HTTP;
    }

    host = (host)
        ? host
        : protocol.replace(SLASH_REGEXP, STRINGS.EMPTY);

    if (host.indexOf(SLASH + SLASH) === 0) {
        host = host.split(SLASH)[2];
    }
    else {
        host = host.split(SLASH)[0];
    }

    port = port || (protocol && ~protocol.indexOf(HTTPS)
        ? HTTPS_PORT
        : HTTP_PORT);

    return JSON.parse(JSON.stringify({
        host: host,
        port: parseInt(port),
        protocol: protocol,
        credentials: credentials || undefined
    }));
}

/**
 *
 * @param proxyToUse
 * @param upstreamHost
 * @returns {{host: string, port: number, protocol: string, credentials: string, upstreamed: boolean}}
 */
module.exports = function getConnectionOptions(proxyToUse, upstreamHost) {
    const upstreamed = !!proxyToUse;
    const upstreamToUse = (upstreamed)
        ? proxyToUse
        : upstreamHost;
    const config = getAddressAndPortFromString(upstreamToUse);
    const objectToReturn = {...config, ...{upstreamed: upstreamed}};
    if (objectToReturn.upstreamed) {
        objectToReturn.upstream = getAddressAndPortFromString(upstreamHost);
    }
    return objectToReturn;
};