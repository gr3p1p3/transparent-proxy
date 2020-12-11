const ProxyServer = require('../ProxyServer');

const server = new ProxyServer({
    upstream: function (data, bridgedConnection, bridgedConnectionId) {
        console.log('Upstreaming for:', bridgedConnectionId);
        if (~(data.toString().indexOf('ifconfig.me'))) {
            return 'myProxy:555'; //using myProxy
        }
        else if (~(data.toString().indexOf('ifconfig.co'))) {
            return 'localhost'; // upstreaming to localhost
        }
        else {
            return '127.0.0.1:9080' //using tor
        }
    },
});

//starting server on port 1555
server.listen(1555, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});