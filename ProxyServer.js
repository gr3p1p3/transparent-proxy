const net = require('net');

const clientResponseWrite = require('./core/clientRequestWrite');
const clientRequestWrite = require('./core/clientResponseWrite');
const resetSockets = require('./core/resetSockets');
const getConnectionOptions = require('./core/getConnectionOptions');
const parseHeaders = require('./lib/parseHeaders');
const isFunction = require('./lib/isFunction');
const usingUpstreamToProxy = require('./lib/usingUpstreamToProxy');
const Logger = require('./lib/Logger');

const {
    DEFAULT_OPTIONS, EVENTS,
    HTTP_BODIES, HTTP_METHODS, HTTP_RESPONSES,
    STRINGS, ERROR_CODES
} = require('./lib/constants');

const {CLOSE, DATA, ERROR, EXIT} = EVENTS;
const {ETIMEDOUT, ENOTFOUND} = ERROR_CODES;
const {CONNECT, GET} = HTTP_METHODS;
const {AUTH_REQUIRED, OK, NOT_OK, TIMED_OUT, NOT_FOUND} = HTTP_RESPONSES;
const {BLANK, CLRF, EMPTY, SEPARATOR, PROXY_AUTH, PROXY_AUTH_BASIC} = STRINGS;

class ProxyServer extends net.createServer {
    constructor(options) {
        const {
            upstream, tcpOutgoingAddress,
            verbose,
            injectData, injectResponse,
            auth
        } = {...DEFAULT_OPTIONS, ...options}; //merging with default options
        const logger = new Logger(verbose);

        const bridgedConnections = {};

        function onConnectedClientHandling(clientSocket) {
            const remotePort = clientSocket.remotePort;
            const remoteAddress = clientSocket.remoteAddress;
            const remoteID = remoteAddress + SEPARATOR + remotePort;

            // logger.log('Received request from', remoteID);

            function onClose(err) {
                if (err && err instanceof Error) {
                    //TODO handle more the errorCodes
                    switch (err.code) {
                        case ETIMEDOUT:
                            clientResponseWrite(bridgedConnections[remoteID], TIMED_OUT + CLRF + CLRF);
                            break;
                        case ENOTFOUND:
                            clientResponseWrite(bridgedConnections[remoteID], NOT_FOUND + CLRF + CLRF + HTTP_BODIES.NOT_FOUND);
                            break;
                        default:
                            //log all unhandled errors
                            logger.error(remoteID, err);
                            clientResponseWrite(bridgedConnections[remoteID], NOT_OK + CLRF + CLRF);
                    }
                }
                resetSockets(remoteID, bridgedConnections);
            }

            function onDataFromUpstream(dataFromUpStream) {
                const responseData = isFunction(injectResponse)
                    ? injectResponse(dataFromUpStream, bridgedConnections[remoteID])
                    : dataFromUpStream;
                clientResponseWrite(bridgedConnections[remoteID], responseData)
            }

            function onDirectConnectionOpen(srcData) {
                const requestData = isFunction(injectData)
                    ? injectData(srcData, bridgedConnections[remoteID])
                    : srcData;
                clientRequestWrite(bridgedConnections[remoteID], requestData);
            }

            function prepareTunnel(data, firstHeaderRow) {
                const upstreamHost = firstHeaderRow.split(BLANK)[1];
                const proxyToUse = usingUpstreamToProxy(upstream, {
                    data,
                    bridgedConnection: bridgedConnections[remoteID]
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
                    //THIS ONLY work if server-listener is not 0.0.0.0 but specific iFace/IP
                    connectionOpt.localAddress = tcpOutgoingAddress(data, bridgedConnections[remoteID]);
                }

                return connectionOpt;
            }

            function handleProxyTunnel(split, data) {
                const firstHeaderRow = split[0];
                const thisTunnel = bridgedConnections[remoteID];

                if (~firstHeaderRow.indexOf(CONNECT)) { //managing HTTP-Tunnel & HTTPs
                    const connectionOpt = prepareTunnel(data, firstHeaderRow);
                    thisTunnel.client
                        .connect(connectionOpt, function onTunnelConnectionOpen(connectionError) {
                            if (connectionError) {
                                return onClose(connectionError);
                            }
                            const proxyToUse = usingUpstreamToProxy(upstream, {
                                data,
                                bridgedConnection: thisTunnel
                            });

                            if (!!proxyToUse) {
                                onDirectConnectionOpen(data);
                            }
                            else {
                                // response as normal http-proxy
                                clientResponseWrite(thisTunnel, OK + CLRF + CLRF);
                            }
                        })
                }
                else if (firstHeaderRow.indexOf(CONNECT) === -1
                    && !thisTunnel.client) { // managing http
                    const connectionOpt = prepareTunnel(data, firstHeaderRow);

                    thisTunnel.client
                        .connect(connectionOpt, function onTunnelConnectionOpen(connectionError) {
                            if (connectionError) {
                                return onClose(connectionError);
                            }
                            onDirectConnectionOpen(data);
                        });

                }
                else if (thisTunnel && thisTunnel.client) {
                    //ToDo injectData will not work on opened https-connection due to ssl (i.e. found a way to implement sslStrip or interception)
                    // onDirectConnectionOpen(data);
                    clientRequestWrite(thisTunnel, data);
                }
                logger.log(remoteID, '=>', thisTunnel.tunnel);
            }

            async function onDataFromClient(data) {
                const dataString = data.toString();
                const thisTunnel = bridgedConnections[remoteID];

                try {
                    if (dataString && dataString.length > 0) {
                        const headers = parseHeaders(data);
                        const split = dataString.split(CLRF); //TODO make secure

                        if (isFunction(auth)
                            && !thisTunnel.authenticated) {
                            const proxyAuth = headers[PROXY_AUTH.toLowerCase()];
                            if (proxyAuth) {
                                const credentials = proxyAuth
                                    .replace(PROXY_AUTH_BASIC, EMPTY);

                                const parsedCredentials = Buffer.from(credentials, 'base64').toString(); //converting from base64
                                const [username, password] = parsedCredentials.split(SEPARATOR); //TODO split at : is not sure enough
                                let isLogged = auth(username, password, thisTunnel);

                                if (isLogged instanceof Promise) {
                                    isLogged = await isLogged;
                                }

                                if (isLogged) {
                                    thisTunnel.authenticated = true;
                                    thisTunnel.user = username;
                                    handleProxyTunnel(split, data);
                                }
                                else {
                                    //return auth-error and close all
                                    clientResponseWrite(thisTunnel, AUTH_REQUIRED + CLRF + CLRF + HTTP_BODIES.AUTH_REQUIRED);
                                    onClose();
                                }
                            }
                            else {
                                clientResponseWrite(thisTunnel, AUTH_REQUIRED + CLRF + CLRF);
                            }
                        }
                        else {
                            handleProxyTunnel(split, data);
                        }
                    }
                }
                catch (err) {
                    onClose(err);
                }
            }

            bridgedConnections[remoteID] = {id: remoteID}; //initializing bridged-connection
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