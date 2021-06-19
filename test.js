const util = require('util');
const exec = util.promisify(require('child_process').exec);

const Logger = require('./lib/Logger');
const ProxyServer = require('./ProxyServer');

//init myLogger in verbose-Mode
const logger = new Logger(true);
//init ProxyServer
const server = new ProxyServer({
    verbose: true,
    // injectResponse: (data, session) => {
    //     if (!session.isHttps) {
    //         console.log('SESSION-DATA', data.toString())
    //     }
    //     return data;
    // }
});

const toTest = ['https://ifconfig.me', 'http://icanhazip.com', 'https://ifconfig.io/ua', 'http://asdahke.e'];

//starting server on port 10001
const PORT = 10001;
server.listen(PORT, '0.0.0.0', async function () {
    logger.log('transparent-proxy was started!', server.address());

    for (const singlePath of toTest) {
        const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' ' + singlePath;
        console.log(cmd);
        const {stdout, stderr} = await exec(cmd);
        console.log('Response =>', stdout);
    }

    logger.log('Closing transparent-proxy Server');
    server.close();
    process.exit();
});