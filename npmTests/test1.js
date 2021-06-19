const util = require('util');
const exec = util.promisify(require('child_process').exec);


async function main() {
    const ProxyServer = require('../ProxyServer');

    console.log('Starting TEST1 - Normal Transparent-Proxy!');

    //init ProxyServer
    const server = new ProxyServer({verbose: true});

    const toTest = ['https://ifconfig.me', 'http://icanhazip.com', 'https://ifconfig.io/ua', 'http://asdahke.e'];

    //starting server on port 10001
    const PORT = 10001;
    server.listen(PORT, '0.0.0.0', async function () {
        console.log('transparent-proxy was started!', server.address());

        for (const singlePath of toTest) {
            const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' ' + singlePath;
            console.log(cmd);
            const {stdout, stderr} = await exec(cmd);
            console.log('Response =>', stdout);
        }

        console.log('Closing transparent-proxy Server\n');
        server.close();
        process.exit();
    });
}


return main();