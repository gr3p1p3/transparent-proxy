import { ProxyServer } from '../ProxyServer.js';
import { util } from 'util';
import { exec as child_process_exec } from 'child_process';

const exec = util.promisify(exec);

const toTest = ['http://v4.ident.me/', 'https://v4.ident.me/'];

const server = new ProxyServer({
    intercept: true,
    verbose: true,
    injectResponse: (data, session) => {
        const ipToSwitch = 'x.x.x.x';
        const switchWithIp = '6.6.6.6';
        // console.log('session.isHttps', session.isHttps)
        if (session.isHttps) {
            const newData = Buffer.from(data.toString()
                .replace(new RegExp('Content-Length: ' + ipToSwitch.length, 'gmi'),
                    'Content-Length: ' + (switchWithIp.length))
                .replace(ipToSwitch, switchWithIp));
            return newData;
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
        console.log('Response =>', stdout);
    }
    server.close();
});
