const util = require('util');
const tls = require("tls");
const exec = util.promisify(require('child_process').exec);
const ProxyServer = require('./ProxyServer');
const forge = require('node-forge');

async function test1() {
    console.log('Starting TEST1 - Normal Transparent-Proxy!');

    //init ProxyServer
    const server = new ProxyServer({verbose: true});

    const toTest = ['https://ifconfig.me', 'http://icanhazip.com', 'https://ifconfig.io/ua', 'http://asdahke.e'];

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

    const toTest = ['https://ifconfig.me', 'http://ifconfig.me'];

    const PORT = 10002; //starting server on port 10001

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

    const toTest = ['http://ifconfig.io/ua', 'https://ifconfig.me/ua'];

    const USER_AGENT = /curl\/.+/;
    const TO_SWITCH = 'Spoofed UA!!';
    const PORT = 10003; //starting server on port 10001

    console.log('Starting Proxy Server with spoof-behaviors');
    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        injectData: (data, session) => {
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

    const toTest = ['https://ifconfig.me/', 'https://ifconfig.me/ua'];

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

    const singlePath = 'https://ifconfig.me/';
    const pwdToTest = ['bar:foo', 'wronguser:wrongpassword'];

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
                        if (err.message.indexOf('HTTP code 407')) return {stdout: 'HTTP CODE 407'};
                        throw err;
                    });
                console.log('Response =>', stdout);

                if (pwd === pwdToTest[0]
                    && stdout === 'HTTP CODE 407') {
                    console.error('Response must not be', 'HTTP CODE 407');
                    process.exit(5);
                }

                if (pwd === pwdToTest[1]
                    && stdout !== 'HTTP CODE 407') {
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

    const toTest = ['http://httpbin.org/headers'];

    const ADDED_HEADER = "x-test: my async value";
    const PORT = 10006;

    console.log('Starting Proxy Server with spoof-behaviors');

    const getHeader = async () =>
        new Promise((resolve) => setTimeout(() => resolve(ADDED_HEADER), 250));

    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        injectData: async (data, session) => {
            const requestLines = data.toString().split("\r\n");
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
                if (JSON.parse(stdout).headers['X-Test'] !== "my async value") {
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
    console.log("Starting TEST7 - Use SNICallback");
  
    const toTest = ["ifconfig.me", "ifconfig.io"];
  
    const PORT = 10007;
  
    //init ProxyServer
    const server = new ProxyServer({
        verbose: true,
        intercept: true,
        handleSni: (hostname, callback) => {
            console.log(`In SNI callback for ${hostname}`)
            try {
                const keypair = forge.rsa.generateKeyPair({bits: 2048, e: 0x10001});
                const cert = forge.pki.createCertificate()
                cert.publicKey = keypair.publicKey
            
                const attrs = [                 
                    {
                      name: 'organizationName',
                      value: 'transparent-proxy',
                    }
                ]
                cert.setIssuer(attrs)
                cert.setSubject([
                   ...attrs,
                  {
                    name: 'commonName',
                    value: hostname,
                  },
                ]);

                cert.sign(keypair.privateKey)
                callback(null, tls.createSecureContext({
                    key: forge.pki.privateKeyToPem(keypair.privateKey),
                    cert: forge.pki.certificateToPem(cert)
                }
                ))
                //throw new Error('not implemented')
            } catch (err) {
                callback(err)
            }
        } 
    });
  
    return new Promise(function (res, rej) {
      server.listen(PORT, "0.0.0.0", async function () {
        console.log("transparent-proxy was started!", server.address());
  
        for (const domain of toTest) {
          const cmd = "curl" + " -v -x 127.0.0.1:" + PORT + " -k https://" + domain;
          console.log(cmd);
          const { stdout, stderr } = await exec(cmd);
          console.log("Response =>", stdout);
          console.log("Log =>", stderr);
          if(!(stderr.includes('issuer: O=transparent-proxy') && stderr.includes(`CN=${domain}`))) {
            console.error(`Certificate issued by O=transtparent-proxy for CN=${domain} expected`)
            process.exit(7)
          }
        }
  
        console.log("Closing transparent-proxy Server - TEST7\n");
        server.close();
        res(true);
      });
    });
}

async function main() {
    await test1();
    await test2();
    await test3();
    await test4();
    await test5();
    await test6();
    await test7();

}

return main();