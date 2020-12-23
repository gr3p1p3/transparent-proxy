const {STRINGS, SLASH_REGEXP, HTTP, HTTPS, HTTP_PORT, HTTPS_PORT} = require('../lib/constants');

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
        ? host.replace(SLASH_REGEXP, STRINGS.EMPTY)
        : protocol.replace(SLASH_REGEXP, STRINGS.EMPTY);

    port = port || (protocol && ~protocol.indexOf(HTTPS)
        ? HTTPS_PORT
        : HTTP_PORT);

    return {
        host: host,
        port: parseInt(port),
        protocol: protocol,
        credentials: credentials
    };
}

/**
 *
 * @param proxyToUse
 * @param upstreamHost
 * @returns {{host: string, port: number, protocol: string, credentials: string, upstreamed: boolean}}
 */
module.exports = function getConnectionOptions(proxyToUse, upstreamHost) {
    const upstreamed = !!proxyToUse;
    const upstreamToUse = (upstreamed) ? proxyToUse : upstreamHost;
    const config = getAddressAndPortFromString(upstreamToUse);
    return {...config, ...{upstreamed: upstreamed}};
};