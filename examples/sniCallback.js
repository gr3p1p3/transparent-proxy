const forge = require('node-forge');
const tls = require('tls');
const fs = require('fs');

const ProxyServer = require('../ProxyServer');

/*
    This example uses SNI to generate certificates for upstream hosts on the fly
    based on an existing CA.
    If the client trusts the CA, SSL connections can be verified correctly while
    retaining the possibility to intercept traffic.

    Uses node-forge for creating & signing certificates.

    Test with curl passing --cacert, note the --insecure/-k flag is not set:
        $ cd examples && node sniCallback.js
        $ curl -v https://google.com -x localhost:8080 --cacert ca.cert
    You'll see information about certificate validation in the output:
        * Server certificate:
        *  subject: CN=google.com
        *  start date: Feb 16 16:41:59 2023 GMT
        *  expire date: Feb 17 16:41:59 2024 GMT
        *  common name: google.com (matched)
        *  issuer: O=transparent-proxy; CN=Transparent Proxy CA
        *  SSL certificate verify ok. 

    Use injectResponse from ./spoofResponseHttps.js to combine spoofing
    behavior with dynamic certificate generation.
*/
const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
const oneYearFromNow = new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000);
// create CA certificate
// It will be probably provisioned using certificate
// and key PEM files in the real world
const caKeys = forge.pki.rsa.generateKeyPair(2048);
const caCert = forge.pki.createCertificate();
caCert.serialNumber = forge.md.md5.create().digest().toHex();
caCert.publicKey = caKeys.publicKey;
caCert.validity.notBefore = yesterday;
caCert.validity.notAfter = oneYearFromNow;

const caAttrs = [
    {
        name: 'organizationName',
        value: 'transparent-proxy',
    },
    {
        name: 'commonName',
        value: 'Transparent Proxy CA',
    },
];
caCert.setSubject(caAttrs);
caCert.setIssuer(caAttrs);
caCert.setExtensions([
    {
        name: 'basicConstraints',
        cA: true,
    },
]);
// self-sign CA certificate
caCert.sign(caKeys.privateKey, forge.md.sha256.create());

// write files to disk so you can use the certificate in a truststore
fs.writeFileSync('./ca.cert', forge.pki.certificateToPem(caCert));
fs.writeFileSync('./ca.key', forge.pki.privateKeyToPem(caKeys.privateKey));
fs.writeFileSync('./ca_pub.key', forge.pki.publicKeyToPem(caKeys.publicKey));

// Set up proxy w/ SNI callback
const server = new ProxyServer({
    verbose: true,
    intercept: true,
    handleSni: (hostname, callback) => {
        console.log(`In SNI callback for ${hostname}`);
        try {
            const hash = forge.md.md5.create();
            hash.update(hostname);
            const upstreamCert = forge.pki.createCertificate();
            upstreamCert.serialNumber = hash.digest().toHex();
            upstreamCert.publicKey = caKeys.publicKey;
            upstreamCert.setSubject([
                {
                    name: 'commonName',
                    value: hostname,
                },
            ]);
            upstreamCert.setExtensions([
                {name: 'basicConstraints', cA: false},
            ]);
            upstreamCert.validity.notBefore = yesterday;
            upstreamCert.validity.notAfter = oneYearFromNow;

            // Sign the upstream certificate using the CA from above
            upstreamCert.setIssuer(caCert.subject.attributes);
            upstreamCert.sign(caKeys.privateKey);

            callback(null, tls.createSecureContext({
                key: forge.pki.privateKeyToPem(caKeys.privateKey),
                cert: forge.pki.certificateToPem(upstreamCert)
            }))
        }
        catch (err) {
            callback(err)
        }
    }
});

server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});