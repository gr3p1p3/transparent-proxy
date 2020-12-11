const net = require('net');

const Logger = require('./lib/Logger');

const clientResponseWrite = require('./lib/clientRequestWrite');
const clientRequestWrite = require('./lib/clientResponseWrite');
const usingUpstreamToProxy = require('./lib/usingUpstreamToProxy');
const resetSockets = require('./lib/resetSockets');
const getConnectionOptions = require('./lib/getConnectionOptions');
const isFunction = require('./lib/isFunction');

const {
    BLANK, CLOSE, CLRF,
    CONNECT, DATA, EMPTY, ERROR, EXIT,
    HTTPS, HTTP_PORT, HTTPS_PORT,
    NOT_OK, OK,
    SEPARATOR, SLASH_REGEXP
} = require('./lib/constants');


class ProxyServer extends net.createServer {
    constructor(options) {
        const {upstream, tcpOutgoingAddress, verbose, injectData, injectResponse}
            = options || {}; //using empty object as default options
        const logger = new Logger(verbose);

        const bridgedConnections = {};

        function onConnectedClientHandling(clientSocket) {
            const remotePort = clientSocket.remotePort;
            const remoteAddress = clientSocket.remoteAddress;
            const remoteID = remoteAddress + SEPARATOR + remotePort;

            logger.log('Received request from', remoteID);

            function onClose(err) {
                if (err && err instanceof Error) {
                    logger.error(err);
                }
                resetSockets(remoteID, bridgedConnections);
            }

            function onDataFromUpstream(dataFromUpStream) {
                const responseData = isFunction(injectResponse)
                    ? injectResponse(dataFromUpStream, bridgedConnections[remoteID], remoteID)
                    : dataFromUpStream;
                clientResponseWrite(bridgedConnections[remoteID], responseData)
            }

            function onDataFromClient(data) {
                const dataString = data.toString();

                function onDirectConnectionOpen() {
                    const requestData = isFunction(injectData)
                        ? injectData(data, bridgedConnections[remoteID], remoteID)
                        : data;

                    clientRequestWrite(bridgedConnections[remoteID], requestData);
                }

                try {
                    if (dataString && dataString.length) {
                        const split = dataString.split(CLRF);
                        const firstHeaderRow = split[0];

                        if (~firstHeaderRow.indexOf(CONNECT)) { //managing HTTP-Tunnel & HTTPs
                            const upstreamHost = firstHeaderRow.split(BLANK)[1];
                            const proxyToUse = usingUpstreamToProxy(upstream, {
                                data,
                                bridgedConnection: bridgedConnections[remoteID],
                                remoteID
                            });

                            const connectionOpt = getConnectionOptions(proxyToUse, upstreamHost);

                            if (isFunction(tcpOutgoingAddress)) {
                                connectionOpt.localAddress = tcpOutgoingAddress(data, bridgedConnections[remoteID], remoteID);
                            }

                            //initializing socket and forwarding received request
                            bridgedConnections[remoteID].tunnel = {
                                ADDRESS: connectionOpt.host,
                                PORT: connectionOpt.port
                            };
                            bridgedConnections[remoteID].client = new net.Socket();
                            bridgedConnections[remoteID].client
                                .connect(connectionOpt, function onTunnelConnectionOpen(connectionError) {
                                    if (connectionError) {
                                        return onClose(connectionError);
                                    }

                                    if (isFunction(upstream)) {
                                        onDirectConnectionOpen();
                                    }
                                    else {
                                        clientResponseWrite(bridgedConnections[remoteID], OK + CLRF + CLRF);
                                    }
                                })
                                .on(DATA, onDataFromUpstream)
                                .on(CLOSE, onClose)
                                .on(ERROR, onClose);

                        }
                        else if (firstHeaderRow.indexOf(CONNECT) === -1
                            && !bridgedConnections[remoteID].client) { // managing http
                            let ADDRESS, PORT;
                            const upstreamHost = firstHeaderRow.split(BLANK)[1];

                            const proxyToUse = usingUpstreamToProxy(upstream, {
                                data,
                                bridgedConnection: bridgedConnections[remoteID],
                                remoteID
                            });

                            if (!!proxyToUse) {
                                ADDRESS = proxyToUse.split(SEPARATOR)[0]
                                    .replace(SLASH_REGEXP, EMPTY);
                                PORT = proxyToUse.split(SEPARATOR)[1];
                            }
                            else {
                                ADDRESS = upstreamHost.split(SEPARATOR)[1]
                                    .replace(SLASH_REGEXP, EMPTY);

                                PORT = upstreamHost.split(SEPARATOR)[2]
                                || (~upstreamHost.split(SEPARATOR)[0].indexOf(HTTPS))
                                    ? HTTPS_PORT : HTTP_PORT;
                            }

                            const connectionOpt = {
                                port: PORT,
                                host: ADDRESS,
                                // localAddress: 'x.x.x.x' //THIS ONLY work if server-listener is not 0.0.0.0 but specific iFace/IP
                            };

                            if (isFunction(tcpOutgoingAddress)) {
                                connectionOpt.localAddress = tcpOutgoingAddress(data, bridgedConnections[remoteID], remoteID);
                            }

                            bridgedConnections[remoteID].tunnel = {ADDRESS, PORT};
                            bridgedConnections[remoteID].client = new net.Socket();
                            bridgedConnections[remoteID].client
                                .connect(connectionOpt, onDirectConnectionOpen)
                                .on(DATA, onDataFromUpstream)
                                .on(CLOSE, onClose)
                                .on(ERROR, onClose);

                        }
                        else if (bridgedConnections[remoteID] && bridgedConnections[remoteID].client) {
                            //ToDo injectData will not work on opened https-connection due to ssl (i.e. found a way to implement sslStrip)
                            // onDirectConnectionOpen();
                            clientRequestWrite(bridgedConnections[remoteID], data);
                        }
                    }
                }
                catch (err) {
                    clientResponseWrite(bridgedConnections[remoteID], NOT_OK + CLRF + CLRF);
                    onClose(err);
                }
            }

            bridgedConnections[remoteID] = {}; //initializing bridged-connection
            bridgedConnections[remoteID].socket = clientSocket
                .on(DATA, onDataFromClient)
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