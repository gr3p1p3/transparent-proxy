const ProxyServer = require('../ProxyServer');

const server = new ProxyServer({
    upstream: function (data, bridgedConnection, bridgedConnectionId) {
        if (~(data.toString().indexOf('ifconfig.me'))) {
            return 'xxxx.com:10001'; //upstream to myProxy
        }
        else if (~(data.toString().indexOf('ifconfig.co'))) {
            return 'localhost'; // upstreaming to localhost
        }
        else {
            return 'x.x.x.x:3128' //upstream to another proxy
        }
    },
    verbose: true
});

//starting server on port 1555
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});