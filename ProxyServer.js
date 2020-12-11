const net = require('net');

const socketWrite = require('./lib/socketWrite');
const clientWrite = require('./lib/clientWrite');
const usingUpstreamToProxy = require('./lib/usingUpstreamToProxy');
const resetSockets = require('./lib/resetSockets');
const isFunction = require('./lib/isFunction');

const {
    CLOSE, CLRF, CONNECT, DATA, ERROR, EXIT, HTTPS, HTTP_PORT, HTTPS_PORT, OK, SEPARATOR, SLASH_REGEXP
} = require('./lib/constants');


class ProxyServer extends net.createServer {
    constructor(options) {
        const {upstream, injectData, tcpOutgoingAddress} = options || {}; //using empty object as default options
        const bridgedConnections = {};

        function onConnectedClientHandling(clientSocket) {
            const remotePort = clientSocket.remotePort;
            const remoteAddress = clientSocket.remoteAddress;
            const remoteID = remoteAddress + SEPARATOR + remotePort;

            function onClose(err) {
                if (err && err instanceof Error) {
                    // console.log('###Error', err);
                    throw err;
                }
                resetSockets(remoteID, bridgedConnections);
            }

            bridgedConnections[remoteID] = {}; //initializing bridged-connection
            bridgedConnections[remoteID].socket = clientSocket
                .on(DATA, function onDataFromClient(data) {
                    const dataString = data.toString();
                    if (dataString && dataString.length) {
                        const split = dataString.split(CLRF);
                        const firstHeaderRow = split[0];

                        if (~firstHeaderRow.indexOf(CONNECT)) { //managing HTTP-Tunnel & HTTPs
                            let ADDRESS, PORT;
                            const upstreamHost = split[0].split(' ')[1];
                            const proxyInUse = usingUpstreamToProxy(upstream, {
                                data,
                                bridgedConnection: bridgedConnections[remoteID],
                                remoteID
                            });

                            if (!!proxyInUse) {
                                ADDRESS = proxyInUse.split(SEPARATOR)[0]
                                    .replace(SLASH_REGEXP, '');
                                PORT = proxyInUse.split(SEPARATOR)[1];
                            }
                            else {
                                ADDRESS = upstreamHost.split(SEPARATOR)[0]
                                    .replace(SLASH_REGEXP, '');
                                PORT = upstreamHost.split(SEPARATOR)[1];
                            }
                            const connectionOpt = {
                                port: PORT,
                                host: ADDRESS,
                                // localAddress: 'x.x.x.x' //THIS ONLY work if server-listener is not 0.0.0.0 but specific iFace/IP
                            };

                            bridgedConnections[remoteID].tunnel = {ADDRESS, PORT};
                            bridgedConnections[remoteID].client = new net.Socket();

                            if (isFunction(tcpOutgoingAddress)) {
                                connectionOpt.localAddress = tcpOutgoingAddress(data, bridgedConnections[remoteID], remoteID);
                            }

                            bridgedConnections[remoteID].client
                                .connect(connectionOpt, function onTunnelConnectionOpen() {
                                    if (isFunction(upstream)) {
                                        data = isFunction(injectData)
                                            ? injectData(data, bridgedConnections[remoteID], remoteID)
                                            : data;

                                        clientWrite(bridgedConnections[remoteID], data)
                                    }
                                    else {
                                        socketWrite(bridgedConnections[remoteID], OK + CLRF + CLRF);
                                    }
                                })
                                .on(DATA, function onDataFromUpstream(dataFromUpStream) {
                                    socketWrite(bridgedConnections[remoteID], dataFromUpStream);
                                })
                                .on(CLOSE, onClose)
                                .on(ERROR, onClose);

                        }
                        else if (firstHeaderRow.indexOf(CONNECT) === -1
                            && !bridgedConnections[remoteID].client) { // managing http
                            let ADDRESS, PORT;
                            const upstreamHost = split[0].split(' ')[1];

                            const proxyToUse = usingUpstreamToProxy(upstream, {
                                data,
                                bridgedConnection: bridgedConnections[remoteID],
                                remoteID
                            });

                            if (!!proxyToUse) {
                                ADDRESS = proxyToUse.split(SEPARATOR)[0].replace(SLASH_REGEXP, '');
                                PORT = proxyToUse.split(SEPARATOR)[1];
                            }
                            else {
                                ADDRESS = upstreamHost.split(SEPARATOR)[1]
                                    .replace(SLASH_REGEXP, '');

                                PORT = upstreamHost.split(SEPARATOR)[2]
                                || (~upstreamHost.split(SEPARATOR)[0].indexOf(HTTPS))
                                    ? HTTPS_PORT : HTTP_PORT;
                            }
                            const connectionOpt = {
                                port: PORT,
                                host: ADDRESS,
                                // localAddress: 'x.x.x.x' //THIS ONLY work if server-listener is not 0.0.0.0 but specific iFace/IP
                            };

                            bridgedConnections[remoteID].tunnel = {ADDRESS, PORT};
                            bridgedConnections[remoteID].client = new net.Socket();

                            if (isFunction(tcpOutgoingAddress)) {
                                connectionOpt.localAddress = tcpOutgoingAddress(data, bridgedConnections[remoteID], remoteID);
                            }

                            bridgedConnections[remoteID].client
                                .connect(connectionOpt, function onDirectConnectionOpen() {
                                    data = isFunction(injectData)
                                        ? injectData(data, bridgedConnections[remoteID], remoteID)
                                        : data;

                                    clientWrite(bridgedConnections[remoteID], data);
                                })
                                .on(DATA, function (dataFromUpStream) {
                                    socketWrite(bridgedConnections[remoteID], dataFromUpStream)
                                })
                                .on(CLOSE, onClose)
                                .on(ERROR, onClose);

                        }
                        else if (bridgedConnections[remoteID] && bridgedConnections[remoteID].client) {
                            //ToDo injectData will not work on opened https-connection due to ssl (i.e. found a way to implement sslStrip)
                            // data = isFunction(injectData)
                            //     ? injectData(data, bridgedConnections[remoteID], remoteID)
                            //     : data;
                            clientWrite(bridgedConnections[remoteID], data);
                        }
                    }
                })
                .on(ERROR, onClose)
                .on(CLOSE, onClose)
                .on(EXIT, onClose);
        }

        super(onConnectedClientHandling);
        this.bridgedConnections = bridgedConnections;
    }

    getBridgedConnections = function () {
        return this.bridgedConnections;
    };
}

module.exports = ProxyServer;