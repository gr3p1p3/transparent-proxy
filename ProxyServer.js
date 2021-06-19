const net = require('net');

const Session = require('./core/Session');
const getConnectionOptions = require('./core/getConnectionOptions');
const parseHeaders = require('./lib/parseHeaders');
const rebuildHeaders = require('./lib/rebuildHeaders');
const isFunction = require('./lib/isFunction');
const usingUpstreamToProxy = require('./lib/usingUpstreamToProxy');
const isValid = require('./lib/isValidASCII');
const Logger = require('./lib/Logger');

const {
    DEFAULT_OPTIONS, EVENTS,
    HTTP_BODIES, HTTP_METHODS, HTTP_RESPONSES,
    STRINGS, ERROR_CODES, HTTPS
} = require('./lib/constants');

const {CLOSE, DATA, ERROR, EXIT} = EVENTS;
const {ETIMEDOUT, ENOTFOUND, EPROTO} = ERROR_CODES;
const {CONNECT, GET} = HTTP_METHODS;
const {AUTH_REQUIRED, OK, NOT_OK, TIMED_OUT, NOT_FOUND} = HTTP_RESPONSES;
const {BLANK, CLRF, EMPTY, SEPARATOR, PROXY_AUTH, PROXY_AUTH_BASIC} = STRINGS;

class ProxyServer extends net.createServer {
    constructor(options) {
        const {
            upstream, tcpOutgoingAddress,
            verbose,
            injectData, injectResponse,
            auth, intercept
        } = {...DEFAULT_OPTIONS, ...options}; //merging with default options
        const logger = new Logger(verbose);

        const bridgedConnections = {};

        function onConnectedClientHandling(clientSocket) {
            const remotePort = clientSocket.remotePort;
            const remoteAddress = clientSocket.remoteAddress;
            const remoteID = remoteAddress + SEPARATOR + remotePort;

            // logger.log('Received request from', remoteID);

            function onClose(err) {
                const thisTunnel = bridgedConnections[remoteID];
                if (err && err instanceof Error) {
                    //TODO handle more the errorCodes
                    switch (err.code) {
                        case ETIMEDOUT:
                            thisTunnel.clientResponseWrite(TIMED_OUT + CLRF + CLRF);
                            break;
                        case ENOTFOUND:
                            thisTunnel.clientResponseWrite(NOT_FOUND + CLRF + CLRF + HTTP_BODIES.NOT_FOUND);
                            break;
                        // case EPROTO:
                        //     thisTunnel.destroy();
                        //     // thisTunnel.clientResponseWrite(NOT_OK + CLRF + CLRF + HTTP_BODIES.NOT_FOUND);
                        //     break;
                        default:
                            //log all unhandled errors
                            logger.error(remoteID, err);
                            thisTunnel.clientResponseWrite(NOT_OK + CLRF + CLRF);
                    }
                }
                if (thisTunnel) {
                    thisTunnel.destroy();
                    delete bridgedConnections[remoteID];
                }
            }

            function onDataFromUpstream(dataFromUpStream) {
                const thisTunnel = bridgedConnections[remoteID];
                const responseData = isFunction(injectResponse)
                    ? injectResponse(dataFromUpStream, thisTunnel)
                    : dataFromUpStream;

                thisTunnel.clientResponseWrite(responseData);
                //updateSockets if needed after first response
                updateSockets();
            }

            function onDirectConnectionOpen(srcData) {
                const thisTunnel = bridgedConnections[remoteID];
                const requestData = isFunction(injectData)
                    ? injectData(srcData, thisTunnel)
                    : srcData;

                thisTunnel.clientRequestWrite(requestData);
            }

            function updateSockets() {
                const thisTunnel = bridgedConnections[remoteID];
                if (thisTunnel.isHttps && intercept) {
                    thisTunnel._updateSockets({onDataFromClient, onDataFromUpstream, onClose})
                }
            }

            function prepareTunnel(data, firstHeaderRow, https = false) {
                const thisTunnel = bridgedConnections[remoteID];
                const upstreamHost = firstHeaderRow.split(BLANK)[1];
                const proxyToUse = usingUpstreamToProxy(upstream, {
                    data,
                    bridgedConnection: thisTunnel
                });
                //initializing socket and forwarding received request
                const connectionOpt = getConnectionOptions(proxyToUse, upstreamHost);
                thisTunnel.isHttps = !!(
                    https
                    || (connectionOpt.upstream
                    && connectionOpt.upstream.protocol === HTTPS));

                thisTunnel.setTunnelOpt(connectionOpt);

                if (isFunction(tcpOutgoingAddress)) {
                    //THIS ONLY work if server-listener is not 0.0.0.0 but specific iFace/IP
                    connectionOpt.localAddress = tcpOutgoingAddress(data, thisTunnel);
                }

                function onTunnelHTTPConnectionOpen(connectionError) {
                    if (connectionError) {
                        return onClose(connectionError);
                    }

                    if (connectionOpt.credentials) {
                        const headers = parseHeaders(data);
                        const basedCredentials = Buffer.from(connectionOpt.credentials)
                            .toString('base64'); //converting to base64
                        headers[PROXY_AUTH.toLowerCase()] = PROXY_AUTH_BASIC + BLANK + basedCredentials;
                        const newData = rebuildHeaders(headers, data);
                        thisTunnel.clientRequestWrite(newData)
                    }
                    else {
                        onDirectConnectionOpen(data);
                    }
                }

                async function onTunnelHTTPSConnectionOpen(connectionError) {
                    if (connectionError) {
                        return onClose(connectionError);
                    }
                    if (connectionOpt.upstreamed) {
                        if (connectionOpt.credentials) {
                            const headers = parseHeaders(data);
                            const basedCredentials = Buffer.from(connectionOpt.credentials).toString('base64'); //converting to base64
                            headers[PROXY_AUTH.toLowerCase()] = PROXY_AUTH_BASIC + BLANK + basedCredentials;
                            const newData = rebuildHeaders(headers, data);
                            thisTunnel.clientRequestWrite(newData)
                        }
                        else {
                            onDirectConnectionOpen(data);
                        }
                    }
                    else {
                        // response as normal http-proxy
                        thisTunnel.clientResponseWrite(OK + CLRF + CLRF);
                        updateSockets();
                    }
                }

                const callbackOnConnect = (https)
                    ? onTunnelHTTPSConnectionOpen
                    : onTunnelHTTPConnectionOpen;

                if (connectionOpt) {
                    logger.log(remoteID, '=>', thisTunnel.getTunnelStats());

                    const responseSocket = net.createConnection(connectionOpt, callbackOnConnect);

                    thisTunnel.setRequestSocket(responseSocket
                        .on(DATA, onDataFromUpstream)
                        .on(CLOSE, onClose)
                        .on(ERROR, onClose)
                    );
                }
                return connectionOpt;
            }

            function handleProxyTunnel(split, data) {
                const firstHeaderRow = split[0];
                const thisTunnel = bridgedConnections[remoteID];

                if (~firstHeaderRow.indexOf(CONNECT)) { //managing HTTP-Tunnel(upstream) & HTTPs
                    prepareTunnel(data, firstHeaderRow, true);
                }
                else if (firstHeaderRow.indexOf(CONNECT) === -1
                    && !thisTunnel._dst) { // managing http
                    prepareTunnel(data, firstHeaderRow);
                }
                else if (thisTunnel && thisTunnel._dst) {
                    return onDirectConnectionOpen(data);
                }
            }

            async function onDataFromClient(data) {
                const dataString = data.toString();
                const thisTunnel = bridgedConnections[remoteID];

                try {
                    if (dataString && dataString.length > 0) {
                        const headers = parseHeaders(data);
                        const split = dataString.split(CLRF); //TODO make secure, split can be limited

                        if (isFunction(auth)
                            && !thisTunnel.isAuthenticated()) {
                            const proxyAuth = headers[PROXY_AUTH.toLowerCase()];
                            if (proxyAuth) {
                                const credentials = proxyAuth
                                    .replace(PROXY_AUTH_BASIC, EMPTY);

                                const parsedCredentials = Buffer.from(credentials, 'base64')
                                    .toString(); //converting from base64
                                const [username, password] = parsedCredentials.split(SEPARATOR); //TODO split can be limited
                                let isLogged = auth(username, password, thisTunnel);

                                if (isLogged instanceof Promise) { //if async operation...
                                    isLogged = await isLogged; //...need to resolve promise
                                }

                                if (isLogged) {
                                    thisTunnel.authenticated = true;
                                    thisTunnel.user = username;
                                    return handleProxyTunnel(split, data);
                                }
                                else {
                                    //return auth-error and close all
                                    thisTunnel.clientResponseWrite(AUTH_REQUIRED + CLRF + CLRF + HTTP_BODIES.AUTH_REQUIRED);
                                    return onClose();
                                }
                            }
                            else {
                                return thisTunnel.clientResponseWrite(AUTH_REQUIRED + CLRF + CLRF);
                            }
                        }
                        else {
                            return handleProxyTunnel(split, data);
                        }
                    }
                }
                catch (err) {
                    return onClose(err);
                }
            }

            bridgedConnections[remoteID] = new Session(remoteID); //initializing bridged-connection
            bridgedConnections[remoteID].setResponseSocket(
                clientSocket
                    .on(DATA, onDataFromClient)
                    .on(ERROR, onClose)
                    .on(CLOSE, onClose)
                    .on(EXIT, onClose)
            );
        }

        super(onConnectedClientHandling);
        this.bridgedConnections = bridgedConnections;
    }

    getBridgedConnections() {
        return this.bridgedConnections;
    };
}

module.exports = ProxyServer;