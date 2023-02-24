const ProxyServer = require('../ProxyServer');
const fs = require('fs');

/**
 *
 * @returns {Promise<string>}
 */
const getHeader = async () =>
    new Promise((resolve) =>
        setTimeout(() => resolve('x-test: added async'), 500)
    );

//init ProxyServer
/*
* self-signed certificates:
  openssl req -x509 -out localhost.crt -keyout localhost.key \
    -newkey rsa:2048 -nodes -sha256 \
    -subj '/CN=localhost' -extensions EXT -config <( \
    printf '[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth')
*/
const server = new ProxyServer({
    verbose: true,
    intercept: true,
    injectData: async (data, session) => {
        let result = data.toString().split('\r\n');
        console.log('data', session.request.headers)
        const separatorIndex = result.findIndex((e) => e === ''); // index to insert header, i.e. as last header
        if (
            result[0] &&
            !result[0].startsWith('--') // don't add header in content chunks
        ) {
            // this works
            // const header = 'x-test: sync';
            console.log('separator', separatorIndex)
            // this jumbles the chunks so the content chunks are sent before the first
            // one, resulting in 400
            const header = await getHeader();

            result.splice(separatorIndex, 0, header);
        }
        console.log(result);
        return result.join('\r\n');
    },
});

server.listen(8888, '0.0.0.0', () => {
    console.log('Proxy started');
});