const util = require('util');
const exec = util.promisify(require('child_process').exec);

const ProxyServer = require('../ProxyServer');

async function main() {
    console.log('Starting TEST3 - Spoof Request!');

    const toTest = ['http://ifconfig.io/ua', 'https://ifconfig.me/ua'];

    const PORT = 10001; //starting server on port 10001

    console.log('Starting Proxy Server with spoof-behaviors');
    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        injectData: (data, session) => {
            return Buffer.from(data.toString().replace('curl/7.55.1', 'Spoofed UA!!'));
        }
    });

    server.listen(PORT, '0.0.0.0', async function () {
        console.log('transparent-proxy was started!', server.address());

        for (const singlePath of toTest) {
            const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' -k ' + singlePath;
            console.log(cmd);
            const {stdout, stderr} = await exec(cmd);
            console.log('Response =>', stdout);
        }

        console.log('Closing transparent-proxy Server\n');
        server.close();
        process.exit(0);
    });
}

return main();