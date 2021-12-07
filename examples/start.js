import { ProxyServer } from '../ProxyServer.js';

//init ProxyServer
const server = new ProxyServer({verbose:true});

//starting server on port 1555
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});
