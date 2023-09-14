/**
 * Write data of given socket
 * @param {net.Socket} socket
 * @param data
 */
module.exports = function socketWrite(socket, data) {
    return new Promise(function (resolve, reject) {
        if (socket && !socket.destroyed && data) {
            return socket.write(data, null, resolve);
        }
        return resolve(false);
    });
};