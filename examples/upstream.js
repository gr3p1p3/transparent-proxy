const ProxyServer = require('../ProxyServer');

const server = new ProxyServer({
    upstream: function (data, bridgedConnection) {
        if (~(data.toString().indexOf('ifconfig.me'))) {
            return 'x.x.x:10001'; //upstream to myProxy
        }
        else if (~(data.toString().indexOf('ifconfig.co'))) {
            return 'x.x.x:10002'; //upstream to another proxy
        }
        else {
            return 'localhost'; // upstreaming to localhost
        }
    },
    verbose: true
});

//starting server on port 1555
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});