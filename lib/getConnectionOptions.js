const {EMPTY, SEPARATOR, SLASH_REGEXP} = require('./constants');

function getAddressAndPortFromString(ipStringWithPort, normalRequest = false) {
    // const firstIndex = (normalRequest) ? 1 : 0;
    // const secondIndex = (normalRequest) ? 2 : 1;

    const address = ipStringWithPort.split(SEPARATOR)[0]
        .replace(SLASH_REGEXP, EMPTY);

    const port = ipStringWithPort.split(SEPARATOR)[1];

    return {address, port};
}

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