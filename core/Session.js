const tls = require('tls');
const {EVENTS, DEFAULT_KEYS, HTTP_METHODS} = require('../lib/constants');
const parseDataToObject = require('../lib/parseDataToObject');
const {CLOSE, DATA, ERROR} = EVENTS;

/**
 * Write data of given socket
 * @param {net.Socket} socket
 * @param data
 */
function socketWrite(socket, data) {
    return new Promise(function (resolve, reject) {
        if (socket && !socket.destroyed && data) {
            return socket.write(data, null, resolve);
        }
        return resolve(false);
    });
}

/**
 * Destroy the socket
 * @param {net.Socket} socket
 */
function socketDestroy(socket) {
    if (socket && !socket.destroyed) {
        socket.destroy();
    }
}

class Session extends Object {
    /**
     *
     * @param {string} id - The used ID.
     */
    constructor(id) {
        super();

        this._id = id;
        this._src = null;
        this._dst = null;
        this._tunnel = {};
        this.user = null;
        this.authenticated = false;
        this.isHttps = false;
        this._request = {};
        this._response = {};
    }

    /**
     * @param {buffer|string} data - The data to send.
     * @returns {Session}
     */
    async clientRequestWrite(data) {
        return socketWrite(this._dst, data);
    }

    /**
     * @param {buffer|string} data - The data to send.
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

    /**
     * Get own id
     * @returns {string}
     */
    getId() {
        return this._id;
    }

    set request(buffer) {
        const parsedRequest = parseDataToObject(buffer);
        if (parsedRequest.headers
            && (!this._request.headers || this.request.method === HTTP_METHODS.CONNECT)) { //if not already set
            this._request = parsedRequest;
        }
        return this._request;
    }

    get request() {
        return this._request;
    }

    set response(buffer) {
        // const indexOfChunkEnd = buffer.toString().indexOf(LF + CRLF);
        // this._response.complete = indexOfChunkEnd; //TODO find a way to recognize last chunk

        const parsedResponse = parseDataToObject(buffer, true, !!this._response.body);
        if (this._response.body
            && parsedResponse.body) {
            parsedResponse.body = this._response.body + parsedResponse.body;
        }
        this._response = {...this._response, ...parsedResponse};

        return this._response;
    }

    get response() {
        return this._response;
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
     * @param {object} KEYS - {key:{string},cert:{string}}
     * @returns {Session}
     * @private
     */
    _updateSockets(callbacksObject, KEYS = DEFAULT_KEYS) {
        const {onDataFromClient, onDataFromUpstream, onClose} = callbacksObject;
        KEYS = KEYS || DEFAULT_KEYS;

        if (!this._updated) {
            const srcSocket = new tls.TLSSocket(this._src, {
                rejectUnauthorized: false,
                requestCert: false,
                isServer: true,
                key: KEYS.key,
                cert: KEYS.cert
            })
                .on(DATA, onDataFromClient)
                .on(CLOSE, onClose)
                .on(ERROR, onClose);

            this.setResponseSocket(srcSocket);

            const dstSocket = new tls.TLSSocket(this._dst, {
                rejectUnauthorized: false,
                requestCert: false,
                isServer: false
            })
                .on(DATA, onDataFromUpstream)
                .on(CLOSE, onClose)
                .on(ERROR, onClose);
            // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L976
            // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L1675-L1686
            dstSocket.setServername(this._dst._host || this._tunnel.UPSTREAM.host);
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
