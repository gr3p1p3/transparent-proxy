const tls = require('tls');
const {EVENTS, KEYS} = require('../lib/constants');
const {CLOSE, DATA, ERROR, EXIT} = EVENTS;

/**
 *
 * @param {net.Socket} socket
 * @param data
 */
function socketWrite(socket, data) {
    if (socket && !socket.destroyed) {
        socket.write(data);
    }
}

/**
 *
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
     * @param id
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
    }

    /**
     *
     * @param {buffer|string} data - The data to send.
     */
    clientRequestWrite(data) {
        socketWrite(this._dst, data);
    }

    /**
     *
     * @param {buffer|string} data - The data to send.
     */
    clientResponseWrite(data) {
        socketWrite(this._src, data);
    }

    /**
     * Destroy existing sockets for this Session-Instance
     */
    destroy() {
        if (this._dst) {
            socketDestroy(this._dst);
        }
        if (this._src) {
            socketDestroy(this._src);
        }
    }

    /**
     * Is Session authenticated by user
     * @returns {boolean|null}
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

    setTunnelOpt(options) {
        const {host, port, upstream} = options;
        this._tunnel.ADDRESS = host;
        this._tunnel.PORT = port;
        if (!!upstream) {
            this._tunnel.UPSTREAM = upstream;
        }
        return this;
    }

    _updateSockets(callbacksObject) {
        const {onDataFromClient, onDataFromUpstream, onClose} = callbacksObject;
        if (!this._updated) {
            this.setResponseSocket(new tls.TLSSocket(this._src, {
                    rejectUnauthorized: false,
                    requestCert: false,
                    isServer: true,
                    key: KEYS.KEY,
                    cert: KEYS.CERT
                })
                    .on(DATA, onDataFromClient)
                    .on(CLOSE, onClose)
                    .on(ERROR, onClose)
            );

            this.setRequestSocket(new tls.TLSSocket(this._dst, {
                    rejectUnauthorized: false,
                    requestCert: false,
                    isServer: false
                })
                    .on(DATA, onDataFromUpstream)
                    .on(CLOSE, onClose)
                    .on(ERROR, onClose)
            );
        }
    }

    /**
     * Get Stats for this tunnel
     * @returns {object}
     */
    getTunnelStats() {
        return this._tunnel;
    }
}

module.exports = Session;