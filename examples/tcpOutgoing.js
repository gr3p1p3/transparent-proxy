import { ProxyServer } from '../ProxyServer.js';

//init ProxyServer
const server = new ProxyServer({
    tcpOutgoingAddress: function (data, bridgedConnection) {
        return 'x.x.x.x'; //using other iFace as default
    }
});

//starting server on port 1555
server.listen(8080, 'y.y.y.y', function () {
    console.log('transparent-proxy Server was started!', server.address());
});
