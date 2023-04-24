/**
 * Start an Express server and initializes all tests
 * @param {Array<object>} tests - [{method:'get', path:'/something', cb: <Function>},...]
 * @returns {Promise<server>}
 */
module.exports = function startServer(tests) {
    const zlib = require('zlib');
    const express = require('express');
    const app = express();

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

        const interval = setInterval(() => {
            // From Node.js docs: Calling .flush() on a compression stream will
            // make zlib return as much output as currently possible.
            gzip.flush();
        }, 1000);

        setTimeout(() => {
            gzip.write('{response:"ok"}');
            clearInterval(interval);
            gzip.end();
        }, 5500);

        // Pipe the Gzip Transform Stream into the Response stream
        gzip.pipe(res);
    });

    app.all('*', function (req, res) {
        res.status(404)
            .send('NOT FOUND!')
            .end();
    });

    return new Promise((resolve, reject) => {
        const server = app.listen(3000, (err) => {
            if (err) reject(err);
            console.log('HttpServer is listening on 3000');
            resolve(server);
        });
    });
};