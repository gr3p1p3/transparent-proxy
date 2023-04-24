const net = require('net');

const Session = require('./Session');
const getConnectionOptions = require('./getConnectionOptions');
const rebuildHeaders = require('../lib/rebuildHeaders');
const isFunction = require('../lib/isFunction');
const usingUpstreamToProxy = require('../lib/usingUpstreamToProxy');

const {
    EVENTS,
    HTTP_BODIES, HTTP_METHODS, HTTP_RESPONSES,
    STRINGS, ERROR_CODES, HTTPS
} = require('../lib/constants');

const {CLOSE, DATA, ERROR, EXIT} = EVENTS;
const {ETIMEDOUT, ENOTFOUND, EPIPE, EPROTO} = ERROR_CODES;
const {CONNECT} = HTTP_METHODS;
const {AUTH_REQUIRED, OK, NOT_OK, TIMED_OUT, NOT_FOUND} = HTTP_RESPONSES;
const {BLANK, CRLF, EMPTY, SEPARATOR, PROXY_AUTH, PROXY_AUTH_BASIC} = STRINGS;
const DOUBLE_CLRF = CRLF + CRLF;

function sleep(ms) {
    return new Promise(function (res, rej) {
        setTimeout(res, ms);
    });
}

/**
 *
 * @param clientSocket
 * @param bridgedConnections
 * @param options
 * @param logger
 */
module.exports = function onConnectedClientHandling(clientSocket, bridgedConnections, options, logger) {
    const {
        upstream, tcpOutgoingAddress,
        injectData, injectResponse,
        auth, intercept, keys,
        handleSni
    } = options;


    const remotePort = clientSocket.remotePort;
    const remoteAddress = clientSocket.remoteAddress;
    const remoteID = remoteAddress + SEPARATOR + remotePort;

    // logger.log('Received request from', remoteID);

    /**
     * @param {Error} err
     */
    function onClose(err) {
        const thisTunnel = bridgedConnections[remoteID];
        if (err && err instanceof Error) {
            //TODO handle more the errorCodes
            switch (err.code) {
                case ETIMEDOUT:
                    if (thisTunnel) {
                        thisTunnel.clientResponseWrite(TIMED_OUT + DOUBLE_CLRF);
                    }
                    break;
                case ENOTFOUND:
                    if (thisTunnel) {
                        thisTunnel.clientResponseWrite(NOT_FOUND + DOUBLE_CLRF + HTTP_BODIES.NOT_FOUND);
                    }
                    break;
                case EPIPE:
                    logger.error(remoteID, err);
                    break;
                // case EPROTO:
                //     // thisTunnel.clientResponseWrite(NOT_OK + DOUBLE_CLRF + HTTP_BODIES.NOT_FOUND);
                //     break;
                case HTTP_BODIES.AUTH_REQUIRED:
                    if (thisTunnel) {
                        thisTunnel.clientResponseWrite(AUTH_REQUIRED + DOUBLE_CLRF + HTTP_BODIES.AUTH_REQUIRED);
                    }
                    break;
                default:
                    //log all unhandled errors
                    logger.error(remoteID, err);
                    if (thisTunnel) {
                        thisTunnel.clientResponseWrite(NOT_OK + DOUBLE_CLRF);
                    }
            }
        }
        if (thisTunnel) {
            thisTunnel.destroy();
            delete bridgedConnections[remoteID];
        }
    }

    /**
     * @param {buffer} dataFromUpStream
     */
    async function onDataFromUpstream(dataFromUpStream) {
        const thisTunnel = bridgedConnections[remoteID];
        if (thisTunnel) {
            if (!thisTunnel._isResponsePaused) {
                thisTunnel.response = dataFromUpStream;
                thisTunnel._pauseResponse();
                const responseData = isFunction(injectResponse)
                    ? await injectResponse(dataFromUpStream, thisTunnel)
                    : dataFromUpStream;
                thisTunnel._resumeResponse();
                await thisTunnel.clientResponseWrite(responseData);
                //updateSockets if needed after first response
                updateSockets();
                return true;
            }
            else {
                await sleep(1); //out from event-loop
                return onDataFromUpstream(dataFromUpStream);
            }
        }
    }

    /**
     * @param {buffer} srcData
     */
    async function onDirectConnectionOpen(srcData) {
        const thisTunnel = bridgedConnections[remoteID];
        if (thisTunnel) {
            if (!thisTunnel._isRequestPaused) {
                thisTunnel._pauseRequest();
                const requestData = isFunction(injectData)
                    ? await injectData(srcData, thisTunnel)
                    : srcData;
                thisTunnel._resumeRequest();
                await thisTunnel.clientRequestWrite(requestData);
                return true;
            }
            else {
                await sleep(1); //out from event-loop
                return onDirectConnectionOpen(srcData);
            }
        }
    }

    function updateSockets() {
        const thisTunnel = bridgedConnections[remoteID];
        if (intercept && thisTunnel && thisTunnel.isHttps && !thisTunnel._updated) {
            const keysObject = isFunction(keys)
                ? keys(thisTunnel)
                : false;

            const keyToUse = (keysObject && typeof keysObject === 'object' && Object.keys(keysObject).length === 2)
                ? keysObject
                : undefined;

            thisTunnel._updateSockets({onDataFromClient, onDataFromUpstream, onClose, handleSni}, keyToUse);
        }
    }

    /**
     * @param {buffer} data
     * @param {string} firstHeaderRow
     * @param {boolean} isConnectMethod - false as default.
     * @returns Promise{boolean|{host: string, port: number, protocol: string, credentials: string, upstreamed: boolean}}
     */
    async function prepareTunnel(data, firstHeaderRow, isConnectMethod = false) {
        const thisTunnel = bridgedConnections[remoteID];
        const upstreamHost = firstHeaderRow.split(BLANK)[1];
        const initOpt = getConnectionOptions(false, upstreamHost);

        thisTunnel.setTunnelOpt(initOpt); //settings opt before callback

        const proxyToUse = await usingUpstreamToProxy(upstream, {
            data,
            bridgedConnection: thisTunnel
        });
        //initializing socket and forwarding received request
        const connectionOpt = getConnectionOptions(proxyToUse, upstreamHost);
        thisTunnel.isHttps = !!(
            isConnectMethod
            || (connectionOpt.upstream
            && connectionOpt.upstream.protocol === HTTPS));

        thisTunnel.setTunnelOpt(connectionOpt); // updating tunnel opt

        if (isFunction(tcpOutgoingAddress)) {
            //THIS ONLY work if server-listener is not 0.0.0.0 but specific iFace/IP
            connectionOpt.localAddress = tcpOutgoingAddress(data, thisTunnel);
        }

        /**
         * @param {Error} connectionError
         */
        async function onTunnelHTTPConnectionOpen(connectionError) {
            if (connectionError) {
                return onClose(connectionError);
            }

            if (connectionOpt.credentials) {
                const headers = thisTunnel.request.headers;
                const basedCredentials = Buffer.from(connectionOpt.credentials)
                    .toString('base64'); //converting to base64
                headers[PROXY_AUTH.toLowerCase()] = PROXY_AUTH_BASIC + BLANK + basedCredentials;
                const newData = rebuildHeaders(headers, data);
                await thisTunnel.clientRequestWrite(newData)
            }
            else {
                await onDirectConnectionOpen(data);
            }
        }

        /**
         * @param {Error} connectionError
         * @returns {Promise<void>}
         */
        async function onTunnelHTTPSConnectionOpen(connectionError) {
            if (connectionError) {
                return onClose(connectionError);
            }
            if (connectionOpt.upstreamed) {
                if (connectionOpt.credentials) {
                    const headers = thisTunnel.request.headers;
                    const basedCredentials = Buffer.from(connectionOpt.credentials).toString('base64'); //converting to base64
                    headers[PROXY_AUTH.toLowerCase()] = PROXY_AUTH_BASIC + BLANK + basedCredentials;
                    const newData = rebuildHeaders(headers, data);
                    await thisTunnel.clientRequestWrite(newData)
                }
                else {
                    await onDirectConnectionOpen(data);
                }
            }
            else {
                // response as normal http-proxy
                await thisTunnel.clientResponseWrite(OK + CRLF + CRLF);
                updateSockets();
            }
        }

        const callbackOnConnect = (isConnectMethod)
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

    /**
     * @param {Array<string>} split
     * @param {buffer} data
     */
    function handleProxyTunnel(split, data) {
        const firstHeaderRow = split[0];
        const thisTunnel = bridgedConnections[remoteID];

        if (~firstHeaderRow.indexOf(CONNECT)) { //managing HTTP-Tunnel(upstream) & HTTPs
            return prepareTunnel(data, firstHeaderRow, true);
        }
        else if (firstHeaderRow.indexOf(CONNECT) === -1
            && !thisTunnel._dst) { // managing http
            return prepareTunnel(data, firstHeaderRow);
        }
        else if (thisTunnel && thisTunnel._dst) {
            return onDirectConnectionOpen(data);
        }
    }

    /**
     * @param {buffer} data
     * @returns {Promise<Session|void>}
     */
    async function onDataFromClient(data) {
        const thisTunnel = bridgedConnections[remoteID];
        thisTunnel.request = data;

        const dataString = data.toString();

        try {
            if (dataString && dataString.length > 0) {
                const headers = thisTunnel.request.headers;
                const split = dataString.split(CRLF);

                if (isFunction(auth)
                    && !thisTunnel.isAuthenticated()) {
                    const proxyAuth = headers[PROXY_AUTH.toLowerCase()];
                    if (proxyAuth) {
                        const credentials = proxyAuth
                            .replace(PROXY_AUTH_BASIC, EMPTY);

                        const parsedCredentials = Buffer.from(credentials, 'base64')
                            .toString(); //converting from base64
                        const [username, password] = parsedCredentials.split(SEPARATOR, 2); //split only once
                        let isLogged = auth(username, password, thisTunnel);

                        if (isLogged instanceof Promise) { //if async operation...
                            isLogged = await isLogged; //...need to resolve promise
                        }

                        if (isLogged) {
                            thisTunnel.setUserAuthentication(username);
                            // cleaning data from headers because we dont need to leak this info
                            const headers = Object.assign({}, thisTunnel.request.headers);
                            delete headers[PROXY_AUTH.toLowerCase()];
                            const newData = rebuildHeaders(headers, data);
                            return handleProxyTunnel(split, newData);
                        }
                        else {
                            //return auth-error and close all
                            const error = new Error(HTTP_BODIES.AUTH_REQUIRED);
                            error.code = HTTP_BODIES.AUTH_REQUIRED;
                            return onClose(error);
                        }
                    }
                    else {
                        return thisTunnel.clientResponseWrite(AUTH_REQUIRED + DOUBLE_CLRF);
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
};
