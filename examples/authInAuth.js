import { ProxyServer } from '../ProxyServer.js';
import { util } from 'util';
import { exec as child_process_exec } from 'child_process';

const exec = util.promisify(child_process_exec);

const toTest = [
    'http://ifconfig.me',
    'https://ifconfig.me',
    'http://icanhazip.com',
    'http://ifconfig.co',
    'https://ifconfig.co',
];

//init ProxyServer
const firstProxyServer = new ProxyServer({
    auth: function (username, password) {
        return (username === 'test' && password === 'testPWD');
    }
});
const firstPort = 10001;
//starting server on port 10001
firstProxyServer.listen(firstPort, '0.0.0.0', async function () {
    console.log('transparent-proxy was started!', firstProxyServer.address());
});


//init ProxyServer2
const secondProxyServer = new ProxyServer({
    upstream: function () {
        return 'test:testPWD@0.0.0.0:' + firstPort;
    }
});
const secondPort = 10002;
//starting server on port 10001
secondProxyServer.listen(secondPort, '0.0.0.0', async function () {
    console.log('2 transparent-proxy was started!', secondProxyServer.address());

    for (const singlePath of toTest) {
        const cmd = 'curl' + ' -x localhost:' + secondPort + ' ' + singlePath;
        console.log(cmd);
        const {stdout, stderr} = await exec(cmd);
        console.log('Response =>', stdout);
    }

    secondProxyServer.close();
    firstProxyServer.close();
});
