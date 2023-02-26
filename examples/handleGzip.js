const ProxyServer = require('../ProxyServer');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const toTest = ['http://httpbin.org/gzip', 'https://httpbin.org/gzip'];


const server = new ProxyServer({
    verbose: true,
    intercept: true,
    injectResponse: (data, session) => {
        if (session.response.complete //if response is finished
            && session.response.headers['content-encoding'] === 'gzip') { //body is gzip
            const zlib = require('zlib');
            zlib.gunzip(session.rawResponse, function (err, decoded) {
                console.log('decoded response', decoded?.toString())
            });
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
        const {stdout, stderr} = await exec(cmd);
        console.log('Response =>', !!stdout.length);
    }
    server.close();
});