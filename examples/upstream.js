const ProxyServer = require('../ProxyServer');

const server = ProxyServer({
    upstream: function (data, bridgedConnection, bridgedConnectionId) {
        console.log(bridgedConnectionId);
        if (~(data.toString().indexOf('ifconfig.me'))) {
            return '5.230.65.45:8080'; //using myProxy
        } else if (~(data.toString().indexOf('ifconfig.co'))) {
            return 'localhost'; // upstreaming to localhost
        } else {
            return '127.0.0.1:9080' //using tor
        }
    },
});

//starting server on port 1555
server.listen(1555, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});