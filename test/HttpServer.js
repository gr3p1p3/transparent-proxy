/**
 * Start an Express server and initializes all tests
 * @param {Array<object>} tests - [{method:'get', path:'/something', cb: <Function>},...]
 * @returns {Promise<server>}
 */
module.exports = function startServer(tests) {
    const {DEFAULT_KEYS} = require('../lib/constants');
    const zlib = require('zlib');
    const express = require('express');
    const app = express();
    const PORT = 3000;
    app.get('/', function (req, res) {
        const responseObject = Object.assign({}, {headers: req.headers}, {ip: req.socket.remoteAddress});
        res.json(responseObject).end();
    });

    app.get('/ip', function (req, res) {
        res.send(req.socket.remoteAddress).end();
    });

    app.get('/ua', function (req, res) {
        res.send(req.headers['user-agent']).end();
    });

    app.get('/gzip-chunked', function (req, res) {
        res.writeHead(200, {
            'Content-Encoding': 'gzip',      // setting the encoding to gzip
        });

        // Create a Gzip Transform Stream
        const gzip = zlib.createGzip();
        gzip.write('{response:"ok"}');
        gzip.end();

        // Pipe the Gzip Transform Stream into the Response stream
        gzip.pipe(res);
    });

    app.all('*', function (req, res) {
        res.status(404)
            .send('NOT FOUND!')
            .end();
    });

    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, (err) => {
            if (err) reject(err);
            console.log('HttpServer is listening on 3000');

            const https = require('https');
            const serverHttps = https.createServer({key: DEFAULT_KEYS.key, cert: DEFAULT_KEYS.cert}, app)
                .listen(PORT + 1, function (err) {
                    console.log('HttpsServer is listening on 3001');
                    const close = ()=> {
                        server.close();
                        serverHttps.close();
                    };
                    resolve(Object.assign({}, server, {close}));
                });

        });
    });
};