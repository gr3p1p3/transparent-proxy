const ProxyServer = require('../ProxyServer');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const toTest = ['http://ifconfig.io/ua', 'https://ifconfig.me/ua'];

const switchWith = 'My Super Spoofed UA!';
const server = new ProxyServer({
    intercept: true,
    verbose: true,
    injectData: (data, session) => {
        if (session.isHttps) {
            const modifiedData = data.toString()
                .replace(session.request.headers['user-agent'], switchWith); //replacing UA-Header-Value

            return Buffer.from(modifiedData);
        }
        return data;
    }
});

const port = 10001;
//starting server on port 10001
server.listen(port, '0.0.0.0', async function () {
    console.log('transparent-proxy was started!', server.address());

    for (const singlePath of toTest) {
        const cmd = 'curl' + ' -x localhost:' + port + ' -k ' + singlePath;
        console.log(cmd);
        const {stdout, stderr} = await exec(cmd)
            .catch((err) => ({stdout: err.message}));
        console.log('Response =>', stdout);
    }
    server.close();
});

// curl -x localhost:10001 http://ifconfig.io/ua
// Response => My Super Fucking Spoofed UA!
//
// curl -x localhost:10001 https://ifconfig.io/ua
// Response => curl/7.55.1