const CLRF = '\r\n';
const net = require('net');

function socketWrite(tunnel, data) {
    if (tunnel && tunnel.socket && !tunnel.socket.destroyed) {
        tunnel.socket.write(data);
    }
}

function clientWrite(tunnel, data) {
    if (tunnel && tunnel.client && !tunnel.client.destroyed) {
        tunnel.client.write(data);
    }
}

function isUsingUpstreamToProxy(upstream, {data, bridgedConnection, remoteID}) {
    return ((upstream && typeof upstream === 'function')
        && (upstream(data, bridgedConnection, remoteID) !== 'localhost'))
}

function ProxyServer(options) {
    let {upstream, injectData} = options || {};
    const bridgedConnections = {};

    function resetSockets(tunnel, id) {
        if (tunnel) {
            if (tunnel.client && !tunnel.client.destroyed) {
                tunnel.client.destroy();
            }
            if (tunnel.socket && !tunnel.socket.destroyed) {
                tunnel.socket.destroy();
            }
            delete bridgedConnections[id];
        }
    }

    const server = net.createServer(function onConnectedClient(clientSocket) {
        const rport = clientSocket.remotePort;
        const raddr = clientSocket.remoteAddress;
        const remoteID = raddr + ':' + rport;
        bridgedConnections[remoteID] = {};

        bridgedConnections[remoteID].socket = clientSocket
            .on('data', function (data) {
                const dataString = data.toString();
                if (dataString && dataString.length) {
                    const split = dataString.split(CLRF);
                    if (~split[0].indexOf('CONNECT')) { //managing HTTP-Tunnel & HTTPs
                        let ADDRESS, PORT;
                        const upstreamHost = split[0].split(' ')[1];
                        if (isUsingUpstreamToProxy(upstream, {
                            data,
                            bridgedConnection: bridgedConnections[remoteID],
                            remoteID
                        })) {
                            const proxyInUse = upstream(data, bridgedConnections[remoteID], remoteID);
                            ADDRESS = proxyInUse.split(':')[0].replace(/\//gmi, '');
                            PORT = proxyInUse.split(':')[1];
                        } else {
                            ADDRESS = upstreamHost.split(':')[0].replace(/\//gmi, '');
                            PORT = upstreamHost.split(':')[1];
                        }
                        bridgedConnections[remoteID].tunnel = {ADDRESS, PORT};
                        bridgedConnections[remoteID].client = new net.Socket();

                        bridgedConnections[remoteID].client
                            .connect({
                                port: PORT,
                                host: ADDRESS,
                                // localAddress: 'x.x.x.x' THIS ONLY MAKe 1to1 connection in case of multiple NICs
                            }, function onTunnelConnectionOpen() {
                                if (isUsingUpstreamToProxy(upstream, {
                                    data,
                                    bridgedConnection: bridgedConnections[remoteID],
                                    remoteID
                                })) {
                                    data = (injectData && typeof injectData === 'function') ? injectData(data, bridgedConnections[remoteID], remoteID) : data;
                                    clientWrite(bridgedConnections[remoteID], data)
                                } else {
                                    socketWrite(bridgedConnections[remoteID], 'HTTP/1.0 200 OK' + CLRF + CLRF);
                                }
                            })
                            .on('data', function (dataFromUpStream) {
                                socketWrite(bridgedConnections[remoteID], dataFromUpStream);
                            })
                            .on('close', function () {
                                resetSockets(bridgedConnections[remoteID], remoteID);
                            })
                            .on('error', function handleError(err) {
                                resetSockets(bridgedConnections[remoteID], remoteID);
                            });

                    } else if (split[0].indexOf('CONNECT') === -1 && !bridgedConnections[remoteID].client) { // managing http
                        let ADDRESS, PORT;
                        const upstreamHost = split[0].split(' ')[1];
                        if (isUsingUpstreamToProxy(upstream, {
                            data,
                            bridgedConnection: bridgedConnections[remoteID],
                            remoteID
                        })) {
                            const proxyToUse = upstream(data, bridgedConnections[remoteID], remoteID);
                            ADDRESS = proxyToUse.split(':')[0].replace(/\//gmi, '');
                            PORT = proxyToUse.split(':')[1];
                        } else {
                            ADDRESS = upstreamHost.split(':')[1].replace(/\//gmi, '');
                            PORT = upstreamHost.split(':')[2] || (~upstreamHost.split(':')[0].indexOf('https')) ? 443 : 80;
                        }

                        bridgedConnections[remoteID].tunnel = {ADDRESS, PORT};
                        bridgedConnections[remoteID].client = new net.Socket();

                        bridgedConnections[remoteID].client
                            .connect(PORT, ADDRESS, function onDirectConnectionOpen() {
                                data = (injectData && typeof injectData === 'function') ? injectData(data, bridgedConnections[remoteID], remoteID) : data;
                                clientWrite(bridgedConnections[remoteID], data);
                            })
                            .on('data', function (dataFromUpStream) {
                                socketWrite(bridgedConnections[remoteID], dataFromUpStream)
                            })
                            .on('close', function () {
                                resetSockets(bridgedConnections[remoteID], remoteID);
                            })
                            .on('error', function handleError(err) {
                                resetSockets(bridgedConnections[remoteID], remoteID);
                            });

                    } else if (bridgedConnections[remoteID] && bridgedConnections[remoteID].client) {
                        data = (injectData && typeof injectData === 'function') ? injectData(data, bridgedConnections[remoteID], remoteID) : data;
                        clientWrite(bridgedConnections[remoteID], data);
                        console.log(bridgedConnections[remoteID].client.localAddress)
                    }
                }
            })
            .on('error', function handleError(err) {
                resetSockets(bridgedConnections[remoteID], remoteID);
            })
            .on('close', function () {
                resetSockets(bridgedConnections[remoteID], remoteID);
            })
            .on('exit', function () {
                resetSockets(bridgedConnections[remoteID], remoteID);
            });
    });

    server.getBridgedConnections = function () {
        return bridgedConnections;
    };

    return server;
}

module.exports = ProxyServer;