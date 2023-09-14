const net = require('net');
const tls = require('tls');
const {EVENTS, DEFAULT_KEYS} = require('../lib/constants');
const {CLOSE, DATA, ERROR} = EVENTS;

const socketWrite = require('../lib/socketWrite');
const HttpMirror = require('./HttpMirror');

/**
 * Destroy the socket
 * @param {net.Socket} socket
 */
function socketDestroy(socket) {
    if (socket && !socket.destroyed) {
        socket.destroy();
    }
}

class Session {
    /**
     * Initialize Session-Instance.
     * @param {String} id - The used ID.
     * @param {Object} interceptOptions - The used option to use when intercepting HTTPs.
     */
    constructor(id, interceptOptions) {
        this._id = id;
        this._src = null;
        this._dst = null;
        this._tunnel = {};
        this.user = null;
        this.authenticated = false;
        this.isHttps = false;
        this._request = {};
        this._response = {};

        this._requestCounter = 0;
        this._responseCounter = 0;
        this._isRequestPaused = false;
        this._isResponsePaused = false;

        this._rawResponseBodyChunks = [];
        this._rawRequestBodyChunks = [];
        this._interceptOptions = interceptOptions;

        this._httpMirror = new HttpMirror(this);
    }

    /**
     * Pause stream for request
     * @private
     */
    _pauseRequest() {
        this._dst.pause();
        this._isRequestPaused = true;
    }

    /**
     * Reactivate stream for requests
     * @private
     */
    _resumeRequest() {
        this._dst.resume();
        this._isRequestPaused = false;
    }

    /**
     * Pause stream for response
     * @private
     */
    _pauseResponse() {
        this._src.pause();
        this._isResponsePaused = true;
    }

    /**
     * Reactivate stream for response
     * @private
     */
    _resumeResponse() {
        this._src.resume();
        this._isResponsePaused = false;
    }

    /**
     * Write given data to destination Socket.
     * @param {buffer|string} data - The data to send. (The outgoing payload)
     * @returns {Session}
     */
    async clientRequestWrite(data) {
        return socketWrite(this._dst, data);
    }

    /**
     * Write given data to source Socket.
     * @param {buffer|string} data - The data to send. (The incoming payload)
     * @returns {Session}
     */
    async clientResponseWrite(data) {
        return socketWrite(this._src, data);
    }

    /**
     * Destroy existing sockets for this Session-Instance
     * @returns {Session}
     */
    destroy() {
        if (this._httpMirror.isListening) {
            this._httpMirror.close();
        }
        if (this._dst) {
            socketDestroy(this._dst);
        }
        if (this._src) {
            socketDestroy(this._src);
        }
        return this;
    }

    /**
     * Is Session authenticated by user
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.authenticated;
    }

    /**
     * Set the socket that will receive response
     * @param {net.Socket} socket
     * @returns {Session}
     */
    setResponseSocket(socket) {
        this._src = socket;
        return this;
    }

    /**
     * Set the socket that will receive request
     * @param {net.Socket} socket
     * @returns {Session}
     */
    setRequestSocket(socket) {
        this._dst = socket;
        return this;
    }

    async sendToMirror(data, isResponse = false) {
        await this._httpMirror.listen(); //this will happen only once

        if (!this.isHttps || this._updated) {
            if (!isResponse) {
                const request = await this._httpMirror.waitForRequest(data); //waiting for parsed request data
                this._request = Object.assign(this._request, request);
            }
            else {
                const response = await this._httpMirror.waitForResponse(data); //waiting for parsed response data
                this._response = Object.assign(this._response, response);
            }
            return true;
        }
        return false;
    }

    /**
     * Get own id
     * @returns {string}
     */
    getId() {
        return this._id;
    }

    get response() {
        return JSON.parse(JSON.stringify(Object.assign({}, this._response, {
            body: this.rawResponse?.toString() || undefined,
        })));
    }

    get request() {
        return JSON.parse(JSON.stringify(Object.assign({}, this._request, {
            body: this.rawRequest?.toString() || undefined,
            trailers: Object.keys(this._request.trailers || {}).length > 0
                ? this._request.trailers
                : undefined
        })));
    }

    /**
     * Get the response body as Buffer.
     * @returns {Buffer}
     */
    get rawResponse() {
        return Buffer.concat(this._rawResponseBodyChunks);
    }

    /**
     * Get the response body as Buffer.
     * @returns {Buffer}
     */
    get rawRequest() {
        return Buffer.concat(this._rawRequestBodyChunks);
    }

    /**
     * @param {string} username
     * @returns {Session}
     */
    setUserAuthentication(username) {
        if (username) {
            this.authenticated = true;
            this.user = username;
        }
        return this;
    }

    /**
     * @param {object} options
     * @returns {Session}
     */
    setTunnelOpt(options) {
        if (options) {
            const {host, port, upstream} = options;
            this._tunnel.ADDRESS = host;
            this._tunnel.PORT = port;
            if (!!upstream) {
                this._tunnel.UPSTREAM = upstream;
            }
        }
        return this;
    }

    /**
     * @param {object} callbacksObject
     * @param {Function} callbacksObject.onDataFromClient
     * @param {Function} callbacksObject.onDataFromUpstream
     * @param {Function} callbacksObject.onClose
     * @param {Function} callbacksObject.handleSni
     * @param {object} KEYS - {key:{string},cert:{string}}
     * @returns {Session}
     * @private
     */
    _updateSockets(callbacksObject, KEYS = DEFAULT_KEYS) {
        const {onDataFromClient, onDataFromUpstream, onClose, handleSni} =
            callbacksObject;

        if (!this._updated) {
            const serverOptions = Object.assign({}, this._interceptOptions.server, {
                isServer: true,
                ...(!handleSni && {
                    key: KEYS.key,
                    cert: KEYS.cert,
                }),
                SNICallback: handleSni,
            });
            const srcSocket = new tls.TLSSocket(this._src, serverOptions)
                .on(DATA, onDataFromClient)
                .on(CLOSE, onClose)
                .on(ERROR, onClose);

            this.setResponseSocket(srcSocket);

            const clientOptions = Object.assign({}, this._interceptOptions.client, {isServer: false});
            const dstSocket = new tls.TLSSocket(this._dst, clientOptions)
                .on(DATA, onDataFromUpstream)
                .on(CLOSE, onClose)
                .on(ERROR, onClose);
            // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L976
            // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L1675-L1686
            dstSocket.setServername(this?._tunnel?.UPSTREAM?.host || this._dst._host);
            this.setRequestSocket(dstSocket);
            this._updated = true;
        }
        return this;
    }

    /**
     * Get Stats for this tunnel
     * @returns {object} - {ADDRESS:'String', PORT:Number, UPSTREAM:{ADDRESS,PORT}}
     */
    getTunnelStats() {
        return this._tunnel;
    }
}

module.exports = Session;
