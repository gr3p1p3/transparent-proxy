const ProxyServer = require('../ProxyServer');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const toTest = ['http://v4.ident.me/', 'https://v4.ident.me/'];

const switchWithIp = 'bla.bla.bla.bla';

const server = new ProxyServer({
    verbose: true,
    injectResponse: (data, session) => {
        if (!session.isHttps && session.response.body) {
            //you can spoof here
            const modifiedData = data.toString()
                .replace(new RegExp(    //overwriting content-length-header for a valid response
                    'Content-Length: ' + session.response.headers['content-length'], 'gmi'),
                    'Content-Length: ' + (switchWithIp.length)
                )
                .replace(session.response.body.trim(), switchWithIp);

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
        const cmd = 'curl' + ' -x localhost:' + port + ' ' + singlePath;
        console.log(cmd);
        const {stdout, stderr} = await exec(cmd);
        console.log('Response =>', stdout);
    }
    server.close();
});

// curl -x localhost:10001 http://v4.ident.me/
// Response => bla.bla.bla.bla
// curl -x localhost:10001 https://v4.ident.me/
// Response => x.x.x.x