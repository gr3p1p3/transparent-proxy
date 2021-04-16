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

    setTunnelOpt(host, port) {
        this._tunnel.ADDRESS = host;
        this._tunnel.PORT = port;
        return this;
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