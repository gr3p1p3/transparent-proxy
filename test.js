const http = require('http');

const Logger = require('./lib/Logger');
const ProxyServer = require('./ProxyServer');

//init myLogger in verbose-Mode
const logger = new Logger(true);
//init ProxyServer
const server = new ProxyServer({verbose: true});

const toTest = ['http://ifconfig.me', 'http://icanhazip.com', 'http://ifconfig.co', 'http://asdahke.e'];

//starting server on port 10001
server.listen(10001, '0.0.0.0', function () {
    logger.log('transparent-proxy was started!', server.address());

    const reqOpt = {
        host: '0.0.0.0', port: 10001,
        method: 'GET',
        headers: {
            'User-Agent': 'curl/7.55.1'
        }
    };

    for (const singlePath of toTest) {
        logger.log('sending HTTP request to =>', singlePath);
        const newReqOpt = JSON.parse(JSON.stringify(reqOpt));
        newReqOpt.path = singlePath;

        http.request(newReqOpt, function (response) {
            let responseMsg = '';

            response.on('data', function (data) {
                responseMsg += data.toString();
                logger.log('for', singlePath, 'received responseData => status:', response.statusCode, '=>', responseMsg);
            });
        })
            .on('error', function (err) {
                logger.error('for', singlePath, 'error =>', err);
            })
            .end();
    }

    setTimeout(function closeProxyServer() {
        logger.log('closing transparent-proxy Server');
        server.close();
        process.exit();
    }, 5000);
});