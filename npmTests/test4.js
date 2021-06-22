const util = require('util');
const exec = util.promisify(require('child_process').exec);

const ProxyServer = require('../ProxyServer');

async function main() {
    console.log('Starting TEST4 - Change Some Keys on runtime!');

    const toTest = ['https://ifconfig.io/ua', 'https://ifconfig.me/ua'];

    const PORT = 10001; //starting server on port 10001

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        keys: (session) => {
            const tunnel = session.getTunnelStats();
            // if (tunnel.ADDRESS === 'ifconfig.io') {
            //     return {key: '', cert: ''};
            // }
            return false;
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