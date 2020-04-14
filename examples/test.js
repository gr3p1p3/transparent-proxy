const ProxyServer = require('../ProxyServer');

const server = ProxyServer({
    upstream: function (data, bridgedConnection, bridgedConnectionId) {
        console.log(bridgedConnectionId);
        if (~(data.toString().indexOf('ifconfig.me'))) {
            console.log('using tor');
            // return '127.0.0.1:9080'; //use tor
            return '5.230.65.45:8080'; //use tor
        } else {
            console.log('ELse');
            return 'localhost'
        }
    },
    // injectData: function (data, bridgedConnection, bridgedConnectionId) {
    //
    // }
});

//starting server on port 1555
server.listen(1555, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});