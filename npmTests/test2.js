const util = require('util');
const exec = util.promisify(require('child_process').exec);

const Logger = require('../lib/Logger');
const ProxyServer = require('../ProxyServer');

async function main() {
    console.log('Starting TEST2 - Spoof Response!');
    let ownIp = '';
    const switchWith = '6.6.6.6';
    const IP_REGEXP = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    //init myLogger in verbose-Mode
    const logger = new Logger(true);
    const toTest = ['https://ifconfig.me', 'http://ifconfig.me'];

    const PORT = 10001; //starting server on port 10001

    const cmdOwnIp = 'curl ' + toTest[0];
    console.log('Getting Own ip with', cmdOwnIp);
    const {stdout, stderr} = await exec(cmdOwnIp);
    ownIp = stdout.match(IP_REGEXP)[0].trim();
    console.log('Your IP is:', ownIp);

    console.log('Starting Proxy Server with spoof-behaviors');
    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        injectResponse: (data, session) => {
            //SPOOFING RETURNED RESPONSE
            if (data.toString().match(ownIp)) {
                const newData = Buffer.from(data.toString()
                    .replace(new RegExp('Content-Length: ' + ownIp.length, 'gmi'),
                        'Content-Length: ' + (switchWith.length))
                    .replace(ownIp, switchWith));

                return newData;
            }

            return data;
        }
    });

    server.listen(PORT, '0.0.0.0', async function () {
        logger.log('transparent-proxy was started!', server.address());

        for (const singlePath of toTest) {
            const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' -k ' + singlePath;
            console.log(cmd);
            const {stdout, stderr} = await exec(cmd);
            console.log('Response =>', stdout);
        }

        logger.log('Closing transparent-proxy Server\n');
        server.close();
        process.exit(0);
    });
}

return main();