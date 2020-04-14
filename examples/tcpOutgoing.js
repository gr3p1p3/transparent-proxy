const ProxyServer = require('../ProxyServer');

//init ProxyServer
const server = ProxyServer({
    tcpOutgoingAddress: function (data, bridgedConnection, bridgedConnectionId) {
        return 'x.x.x.x'; //using other iFace as default
    }
});

//starting server on port 1555
server.listen(8080, 'y.y.y.y', function () {
    console.log('transparent-proxy Server was started!', server.address());
});