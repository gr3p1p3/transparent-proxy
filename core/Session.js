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
        this.authenticated = null;
        this.user = null;
    }

    clientRequestWrite(data) {
        socketWrite(this._dst, data);
    }

    clientResponseWrite(data) {
        socketWrite(this._src, data);
    }

    destroy() {
        if (this._dst) {
            socketDestroy(this._dst);
        }
        if (this._src) {
            socketDestroy(this._src);
        }
    }

    isAuthenticated() {
        return this.authenticated;
    }

    setResponseSocket(socket) {
        this._src = socket;
        return this;
    }

    setRequestSocket(socket) {
        this._dst = socket;
        return this;
    }

    getId() {
        return this._id;
    }

    getTunnelStats() {
        return this._tunnel;
    }
}

module.exports = Session;