module.exports = function clientWrite(tunnel, data) {
    if (tunnel && tunnel.client && !tunnel.client.destroyed) {
        tunnel.client.write(data);
    }
};