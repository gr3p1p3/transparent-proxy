const net = require('net');

const Logger = require('./lib/Logger');

const clientResponseWrite = require('./lib/clientRequestWrite');
const clientRequestWrite = require('./lib/clientResponseWrite');
const usingUpstreamToProxy = require('./lib/usingUpstreamToProxy');
const resetSockets = require('./lib/resetSockets');
const getConnectionOptions = require('./lib/getConnectionOptions');
const isFunction = require('./lib/isFunction');

const {
    EVENTS,
    HTTP_METHODS, HTTP_RESPONSES, STRINGS,
    ERROR_CODES
} = require('./lib/constants');

const {CLOSE, DATA, ERROR, EXIT} = EVENTS;
const {ETIMEDOUT, ENOTFOUND} = ERROR_CODES;
const {CONNECT, GET} = HTTP_METHODS;
const {OK, NOT_OK, TIMED_OUT, NOT_FOUND} = HTTP_RESPONSES;
const {BLANK, CLRF, SEPARATOR} = STRINGS;


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
                    //TODO handle more the errorCodes
                    if (err.code === ETIMEDOUT) {
                        clientResponseWrite(bridgedConnections[remoteID], TIMED_OUT + CLRF + CLRF);
                    }
                    else if (err.code === ENOTFOUND) {
                        clientResponseWrite(bridgedConnections[remoteID], NOT_FOUND + CLRF + CLRF);
                    }
                    else {
                        //log all unhandled errors
                        logger.error(remoteID, err);
                    }
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
                    if (dataString && dataString.length > 0) {
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

                            //initializing socket and forwarding received request
                            bridgedConnections[remoteID].tunnel = {
                                ADDRESS: connectionOpt.host,
                                PORT: connectionOpt.port
                            };
                            bridgedConnections[remoteID].client = new net.Socket()
                                .on(DATA, onDataFromUpstream)
                                .on(CLOSE, onClose)
                                .on(ERROR, onClose);

                            if (isFunction(tcpOutgoingAddress)) {
                                connectionOpt.localAddress = tcpOutgoingAddress(data, bridgedConnections[remoteID], remoteID);
                            }

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


                        }
                        else if (firstHeaderRow.indexOf(CONNECT) === -1
                            && !bridgedConnections[remoteID].client) { // managing http
                            const upstreamHost = firstHeaderRow.split(BLANK)[1];
                            const proxyToUse = usingUpstreamToProxy(upstream, {
                                data,
                                bridgedConnection: bridgedConnections[remoteID],
                                remoteID
                            });

                            const connectionOpt = getConnectionOptions(proxyToUse, upstreamHost);

                            //initializing socket and forwarding received request
                            bridgedConnections[remoteID].tunnel = {
                                ADDRESS: connectionOpt.host,
                                PORT: connectionOpt.port
                            };
                            bridgedConnections[remoteID].client = new net.Socket()
                                .on(DATA, onDataFromUpstream)
                                .on(CLOSE, onClose)
                                .on(ERROR, onClose);

                            if (isFunction(tcpOutgoingAddress)) {
                                connectionOpt.localAddress = tcpOutgoingAddress(data, bridgedConnections[remoteID], remoteID);
                            }

                            bridgedConnections[remoteID].client
                                .connect(connectionOpt, onDirectConnectionOpen);
                        }
                        else if (bridgedConnections[remoteID] && bridgedConnections[remoteID].client) {
                            //ToDo injectData will not work on opened https-connection due to ssl (i.e. found a way to implement sslStrip or interception)
                            // onDirectConnectionOpen();
                            clientRequestWrite(bridgedConnections[remoteID], data);
                        }
                        logger.log(remoteID, '=>', bridgedConnections[remoteID].tunnel);
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

    getBridgedConnections() {
        return this.bridgedConnections;
    };
}

module.exports = ProxyServer;