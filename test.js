const util = require('util');
const tls = require('tls');
const exec = util.promisify(require('child_process').exec);
const ProxyServer = require('./ProxyServer');
const forge = require('node-forge');
const HttpServer = require('./test/HttpServer');

async function test1() {
    console.log('Starting TEST1 - Normal Transparent-Proxy!');

    //init ProxyServer
    const server = new ProxyServer({verbose: true});

    const toTest = ['http://localhost:3000', 'http://localhost:3000/notFound'];

    //starting server on port 10001
    const PORT = 10001;
    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const singlePath of toTest) {
                const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' ' + singlePath;
                console.log(cmd);
                const {stdout, stderr} = await exec(cmd);
                console.log('Response =>', stdout);
            }

            console.log('Closing transparent-proxy Server - TEST1\n');
            server.close();
            res(true);
        });
    });
}

async function test2() {
    console.log('Starting TEST2 - Spoof Response!');
    let ownIp = '';
    const TO_SWITCH = '6.6.6.6';
    const IP_REGEXP = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;

    const toTest = ['http://localhost:3000/ip'];

    const PORT = 10002; //starting server on port 10001

    const cmdOwnIp = 'curl ' + toTest[0];
    console.log('Getting Own ip with', cmdOwnIp);
    const {stdout, stderr} = await exec(cmdOwnIp);
    ownIp = stdout;//.match(IP_REGEXP)[0].trim();
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
                        'Content-Length: ' + (TO_SWITCH.length))
                    .replace(ownIp, TO_SWITCH));

                return newData;
            }

            return data;
        }
    });

    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const singlePath of toTest) {
                const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' -k ' + singlePath;
                console.log(cmd);
                const {stdout, stderr} = await exec(cmd);
                console.log('Response =>', stdout);
                if (stdout !== TO_SWITCH) {
                    console.error('Response must be', TO_SWITCH);
                    process.exit(2);
                }
            }

            console.log('Closing transparent-proxy Server - TEST2\n');
            server.close();
            res(true);
        });
    });
}

async function test3() {
    console.log('Starting TEST3 - Spoof Request!');

    const toTest = ['http://localhost:3000/ua'];

    const USER_AGENT = /curl\/.+/;
    const TO_SWITCH = 'Spoofed UA!!';
    const PORT = 10003; //starting server on port 10001

    console.log('Starting Proxy Server with spoof-behaviors');
    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        injectData: (data, session) => {
            if (!session.request.headers?.['user-agent']?.match(USER_AGENT)) {
                console.error('Original User-Agent', session.request.headers['user-agent']);
                process.exit(3);
            }
            return Buffer.from(data.toString().replace(USER_AGENT, TO_SWITCH));
        }
    });

    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const singlePath of toTest) {
                const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' -k ' + singlePath;
                console.log(cmd);
                const {stdout, stderr} = await exec(cmd);
                console.log('Response =>', stdout);
                if (stdout.trim() !== TO_SWITCH) {
                    console.error('Response must be', TO_SWITCH);
                    process.exit(3);
                }
            }

            console.log('Closing transparent-proxy Server - TEST3\n');
            server.close();
            res(true);
        });
    })
}

async function test4() {
    console.log('Starting TEST4 - Change Some Keys on runtime!');

    const toTest = ['http://localhost:3000']; //TODO need https for this

    const PORT = 10004; //starting server on port 10001

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        keys: (session) => {
            const tunnel = session.getTunnelStats();
            console.log('\t\t=> Could change keys for', tunnel);
            return false;
        }
    });

    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const singlePath of toTest) {
                const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' -k ' + singlePath;
                console.log(cmd);
                const {stdout, stderr} = await exec(cmd);
                console.log('Response =>', stdout);
            }

            console.log('Closing transparent-proxy Server - TEST4\n');
            server.close();
            res(true);
        });
    });
}

async function test5() {
    console.log('Starting TEST5 - Proxy With Authentication!');

    const singlePath = 'http://localhost:3000/';
    const pwdToTest = ['bar:foo', 'wronguser:wrongpassword'];
    const {AUTH_REQUIRED} = require('./lib/constants').HTTP_BODIES;

    const PORT = 10005; //starting server on port 10001

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        auth: (username, password, session) => {
            return username === 'bar' && password === 'foo';
        }
    });

    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const pwd of pwdToTest) {
                const cmd = 'curl' + ' -x ' + pwd + '@127.0.0.1:' + PORT + ' ' + singlePath;
                console.log(cmd);
                const {stdout, stderr} = await exec(cmd)
                    .catch((err) => {
                        if (err.message.indexOf('HTTP code 407')) return {stdout: AUTH_REQUIRED};
                        throw err;
                    });
                console.log('Response =>', stdout);

                if (pwd === pwdToTest[0]
                    && stdout === AUTH_REQUIRED) {
                    console.error('Response must not be', 'HTTP CODE 407');
                    process.exit(5);
                }

                if (pwd === pwdToTest[1]
                    && stdout !== AUTH_REQUIRED) {
                    console.error('Response must be', 'HTTP CODE 407');
                    process.exit(5);
                }
            }

            console.log('Closing transparent-proxy Server - TEST5\n');
            server.close();
            res(true);
        });
    });
}

async function test6() {
    console.log('Starting TEST6 - Async inject data');

    const toTest = ['http://localhost:3000'];

    const ADDED_HEADER = 'x-test: my async value';
    const PORT = 10006;

    console.log('Starting Proxy Server with spoof-behaviors');

    const getHeader = async () =>
        new Promise((resolve) => setTimeout(() => resolve(ADDED_HEADER), 250));

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        injectData: async (data, session) => {
            const requestLines = data.toString().split('\r\n');
            // add the new header after the request line
            requestLines.splice(2, 0, `${await getHeader()}`);
            return requestLines.join('\r\n');
        }
    });

    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const singlePath of toTest) {
                const cmd = 'curl' + ' -vv -x 127.0.0.1:' + PORT + ' -k ' + singlePath;
                console.log(cmd);
                const {stdout, stderr} = await exec(cmd);
                console.log('Response =>', stdout);
                if (JSON.parse(stdout).headers['x-test'] !== 'my async value') {
                    console.error(`Header ${ADDED_HEADER} must have been sent`);
                    process.exit(6);
                }
            }

            console.log('Closing transparent-proxy Server - TEST6\n');
            server.close();
            res(true);
        });
    })
}

async function test7() {
    console.log('Starting TEST7 - Custom Logger');

    const toTest = ['http://localhost:3000'];

    const PORT = 10007;

    console.log('Starting Proxy Server with custom logger');
    let logs = [];
    const loggerStub = {
        log(args) {
            logs.push(args)
        },

        error(args) {
            logs.push(args)
        }
    };

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        logger: loggerStub,
    });

    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const singlePath of toTest) {
                const cmd = 'curl' + ' -x 127.0.0.1:' + PORT + ' -k ' + singlePath;
                logs = [];
                await exec(cmd);

                if (!logs.length) {
                    console.error('Url should have been written to logs', logs);
                    process.exit(7);
                }
            }

            console.log('Closing transparent-proxy Server - TEST7\n');
            server.close();
            res(true);
        });
    })
}

async function test8() {
    console.log('Starting TEST8 - Use SNICallback');

    const toTest = ['ifconfig.me', 'ifconfig.io']; //protocol will be append later

    const PORT = 10008;

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        handleSni: (hostname, callback) => {
            console.log(`In SNI callback for ${hostname}`);
            try {
                const keypair = forge.rsa.generateKeyPair({bits: 2048, e: 0x10001});
                const cert = forge.pki.createCertificate();
                cert.publicKey = keypair.publicKey;

                const attrs = [
                    {
                        name: 'organizationName',
                        value: 'transparent-proxy',
                    }
                ];
                cert.setIssuer(attrs);
                cert.setSubject([
                    ...attrs,
                    {
                        name: 'commonName',
                        value: hostname,
                    },
                ]);

                cert.sign(keypair.privateKey);
                callback(null, tls.createSecureContext({
                        key: forge.pki.privateKeyToPem(keypair.privateKey),
                        cert: forge.pki.certificateToPem(cert)
                    }
                ))
            }
            catch (err) {
                callback(err)
            }
        }
    });

    return new Promise(function (res, rej) {
        server.listen(PORT, '0.0.0.0', async function () {
            console.log('transparent-proxy was started!', server.address());

            for (const domain of toTest) {
                const cmd = 'curl' + ' -v -x 127.0.0.1:' + PORT + ' -k https://' + domain;
                console.log(cmd);
                const {stdout, stderr} = await exec(cmd);
                console.log('Response =>', stdout);
                console.log('Log =>', stderr);
                if (!(stderr.includes('issuer: O=transparent-proxy') && stderr.includes(`CN=${domain}`))) {
                    console.error(`Certificate issued by O=transparent-proxy for CN=${domain} expected`);
                    process.exit(8);
                }
            }

            console.log('Closing transparent-proxy Server - TEST8\n');
            server.close();
            res(true);
        });
    });
}

async function test9() {
    console.log('Starting TEST9 - Use Gzip with Transfer');
    const toTest = ['http://localhost:3000/gzip-chunked'];
    const MUST_BE = '{response:"ok"}';

    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        injectResponse: (data, session) => {
            if (session.response.complete) { //if response is finished
                console.log('Response is completed');
                const zlib = require('zlib');
                zlib.gunzip(session.rawResponse, function (err, decoded) {
                    if (decoded.toString() !== MUST_BE) {
                        console.error('Decoded is not', MUST_BE, 'but is', decoded.toString());
                        process.exit(9);
                    }

                });
            }
            return data;
        }
    });

    const port = 10009;
    //starting server on port 10009
    server.listen(port, '0.0.0.0', async function () {
        console.log('transparent-proxy was started!', server.address());

        for (const singlePath of toTest) {
            const cmd = 'curl' + ' -x localhost:' + port + ' -k ' + singlePath;
            console.log(cmd);
            const {stdout, stderr} = await exec(cmd);
            console.log('Response =>', stdout,!!stdout.length, stderr);
        }
        server.close();
    });
}

async function main() {
    const server = await HttpServer([]);
    await test1();
    await test2();
    await test3();
    await test4();
    await test5();
    await test6();
    await test7();
    // await test8(); //TODO reactivate this, validation doesn't work with curl 7.83
    // await test9(); //TODO why return an ECONNREFUSED?
    server.close();
}

return main();