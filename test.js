const ProxyServer = require('./ProxyServer');

//init ProxyServer
const server = ProxyServer();

//starting server on port 1555
server.listen(8080, '0.0.0.0', function () {
    console.log('transparent-proxy Server was started!', server.address());
});

// setTimeout(function closeProxyServer() {
//     console.log('closing transparent-proxy Server');
//     server.close();
// }, 5000);