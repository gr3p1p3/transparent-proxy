const {STRINGS, SLASH_REGEXP, HTTP, HTTPS, HTTP_PORT, HTTPS_PORT} = require('../lib/constants');

function getAddressAndPortFromString(ipStringWithPort) {
    let [protocol, address, port] = ipStringWithPort.split(STRINGS.SEPARATOR);

    if (protocol.indexOf(HTTP) === -1) {
        port = address;
        address = protocol;
        protocol = (port && parseInt(port) === HTTPS_PORT)
            ? HTTPS
            : HTTP;
    }

    address = (address)
        ? address.replace(SLASH_REGEXP, STRINGS.EMPTY)
        : protocol.replace(SLASH_REGEXP, STRINGS.EMPTY);

    port = parseInt(port) || (protocol && ~protocol.indexOf(HTTPS)
        ? HTTPS_PORT
        : HTTP_PORT);

    return {protocol, address, port};
}

/**
 *
 * @param proxyToUse
 * @param upstreamHost
 * @returns {{port: number, host: string}}
 */
module.exports = function getConnectionOptions(proxyToUse, upstreamHost) {
    let ADDRESS, PORT;
    if (!!proxyToUse) {
        const connOpt = getAddressAndPortFromString(proxyToUse);
        ADDRESS = connOpt.address;
        PORT = connOpt.port;
    }
    else {
        const connOpt = getAddressAndPortFromString(upstreamHost);
        ADDRESS = connOpt.address;
        PORT = connOpt.port;
    }

    return {
        port: parseInt(PORT),
        host: ADDRESS,
        // localAddress: 'x.x.x.x' //THIS ONLY work if server-listener is not 0.0.0.0 but specific iFace/IP
    };
};