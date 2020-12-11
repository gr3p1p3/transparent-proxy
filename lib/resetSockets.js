module.exports = function resetSockets(id, bridgedConnections) {
    const tunnel = bridgedConnections[id];
    //ToDo maybe here an onErrorEvent-Handler for users
    if (tunnel) {
        if (tunnel.client && !tunnel.client.destroyed) {
            tunnel.client.destroy();
        }
        if (tunnel.socket && !tunnel.socket.destroyed) {
            tunnel.socket.destroy();
        }
        delete bridgedConnections[id];
    }
};