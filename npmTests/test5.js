const util = require('util');
const exec = util.promisify(require('child_process').exec);

const ProxyServer = require('../ProxyServer');

async function main() {
    console.log('Starting TEST5 - Proxy With Authentication!');

    const singlePath = 'https://ifconfig.me/';
    const pwdToTest = ['bar:foo', 'wronguser:wrongpassword'];

    const PORT = 10001; //starting server on port 10001

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        auth: (username, password, session) => {
            return username === 'bar' && password === 'foo';
        }
    });

    server.listen(PORT, '0.0.0.0', async function () {
        console.log('transparent-proxy was started!', server.address());

        for (const pwd of pwdToTest) {
            const cmd = 'curl' + ' -x ' + pwd + '@127.0.0.1:' + PORT + ' ' + singlePath;
            console.log(cmd);
            const {stdout, stderr} = await exec(cmd)
                .catch((err) => {
                    if (err.message.indexOf('HTTP code 407')) return {stdout: 'HTTP CODE 407'};
                    throw err;
                });
            console.log('Response =>', stdout);
        }

        console.log('Closing transparent-proxy Server\n');
        server.close();
        process.exit(0);
    });
}

return main();