module.exports = function socketWrite(tunnel, data) {
    if (tunnel && tunnel.socket && !tunnel.socket.destroyed) {
        tunnel.socket.write(data);
    }
};