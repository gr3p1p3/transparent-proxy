const http = require('http');
const net = require('net');

const {STRINGS} = require('../lib/constants');
const {CRLF, TRANSFER_ENCODING, CONTENT_LENGTH, CHUNKED, ZERO} = STRINGS;

module.exports = class HttpMirror {
    constructor(session) {
        this.server = http.createServer();
        // this.client = http.request;
        this.isListening = false;
        this._session = session;
        this._mirror = {
            server: {request: false, response: false},
            client: {request: false, response: false}
        };
    }

    async close() {
        return new Promise((resolve) => {
            if (this.isListening) {
                this.server.close(resolve);
                return true;
            }
            resolve(false);
            return false;
        });

    }

    listen() {
        return new Promise((resolve, reject) => {
            if (this.isListening) {
                resolve(true);
                return;
            }
            //starting http-server on random port
            this.server.listen(0, 'localhost', () => {
                this.isListening = true;
                resolve(true);
            });
        });
    }

    waitForRequest(data) {
        const session = this._session;

        return new Promise(async (resolve) => {
            const serverInfo = this.server.address();
            const config = {host: serverInfo.address, port: serverInfo.port};

            if (!this._mirror?.client?.request) {
                this._mirror.client.request = net.createConnection(config);

                this.server
                    .once('connect', (request, clientSocket) => {
                        const {method, url, headers, httpVersion, trailers} = request;
                        this._mirror.client.request = false;
                        clientSocket.destroy();
                        resolve({method, url, headers, httpVersion, trailers});
                    })
                    .once('request', (request, response) => {
                        this._mirror.client.requesthandler = request;
                        this._mirror.client.response = response;
                        const {method, url, headers, httpVersion, trailers} = request;

                        request.on('data', (chunk) => {
                            session._requestCounter++;
                            session._rawRequestBodyChunks.push(chunk);
                        })
                            .once('data', () => {
                                resolve({method, url, headers, httpVersion, trailers});
                            })
                            .once('end', () => {
                                this._mirror.client.response.end();
                                this._mirror.client.request.destroy();
                                this._mirror.client.requesthandler.destroy();
                                session._request.complete = true;
                                resolve({method, url, headers, httpVersion, trailers});
                            });
                    });
                return this._mirror.client.request.write(data);
            }
            else {
                const {method, url, headers, httpVersion, trailers} = this._mirror.client.requestHandler;

                this._mirror.client.requestHandler
                    .once('data', () => {
                        resolve({method, url, headers, httpVersion, trailers});
                    })
                    .once('end', () => {
                        resolve({method, url, headers, httpVersion, trailers});
                    });
                return this._mirror.client.request.write(data);
            }
        });
    }

    waitForResponse(data) {
        const session = this._session;
        return new Promise((resolve) => {
            if (!this._mirror?.server?.response) {
                this.server.once('request', (request, response) => {
                    this._mirror.server.response = response;
                    response.socket.write(data); //dumping TCP data
                });

                const {address, port} = this.server.address();
                const request = session._request;
                const options = {method: request.method, headers: request.headers, path: '/', host: address, port};
                delete options.headers.host;

                http.request(options, (response) => {
                    const {headers, httpVersion, statusCode} = response;
                    this._mirror.server.request = response;

                    response
                        .on('data', (chunk) => {
                            session._responseCounter++;
                            session._rawResponseBodyChunks.push(chunk);
                            if (headers?.[CONTENT_LENGTH]) {
                                const bodyBytes = Buffer.byteLength(session.rawResponse);
                                session._response.complete = parseInt(headers[CONTENT_LENGTH]) <= bodyBytes;
                            }
                        })
                        .once('data', (chunk) => {
                            resolve({headers, httpVersion, statusCode});
                        })
                        .once('close', async () => {
                            session._response.complete = true;
                            this._mirror?.server?.request?.destroy();
                            this._mirror?.server?.response?.end();
                            await this.close(); //closing this instance at the end of response
                            resolve({headers, httpVersion, statusCode});
                        });

                    setTimeout(() => {
                        resolve({headers, httpVersion, statusCode}); //resolving in case of no data after 10ms
                    }, 10);
                })
                    .end();
            }
            else {
                const {headers, httpVersion, statusCode} = this._mirror.server.request;
                this._mirror.server.request
                    .once('data', () => {
                        resolve({headers, httpVersion, statusCode});
                    })
                    .once('close', () => {
                        resolve({headers, httpVersion, statusCode});
                    });
                return this._mirror.server.response.socket.write(data); //dumping TCP data to existing response-Object
            }
        });
    }
};