const tls = require('tls');
const {EVENTS, DEFAULT_KEYS, STRINGS, HTTP_METHODS} = require('../lib/constants');
const parseDataToObject = require('../lib/parseDataToObject');
const {CLOSE, DATA, ERROR} = EVENTS;
const {BINARY_ENCODING, CRLF, TRANSFER_ENCODING, CONTENT_LENGTH, CHUNKED, ZERO} = STRINGS;
const NOT_HEX_VALUE = /[^0-9A-Fa-f]/g;

/**
 * Write data of given socket
 * @param {net.Socket} socket
 * @param data
 */
function socketWrite(socket, data) {
    return new Promise(function (resolve, reject) {
        if (socket && !socket.destroyed && data) {
            return socket.write(data, null, resolve);
        }
        return resolve(false);
    });
}

/**
 * Destroy the socket
 * @param {net.Socket} socket
 */
function socketDestroy(socket) {
    if (socket && !socket.destroyed) {
        socket.destroy();
    }
}

class Session {
    /**
     *
     * @param {string} id - The used ID.
     */
    constructor(id) {
        this._id = id;
        this._src = null;
        this._dst = null;
        this._tunnel = {};
        this.user = null;
        this.authenticated = false;
        this.isHttps = false;
        this._request = {};
        this._response = {};

        this._requestCounter = 0;
        this._responseCounter = 0;
        this._isRequestPaused = false;
        this._isResponsePaused = false;

        this._rawResponseBodyChunks = [];
    }

    _pauseRequest() {
        this._dst.pause();
        this._isRequestPaused = true;
    }

    _resumeRequest() {
        this._dst.resume();
        this._isRequestPaused = false;
    }

    _pauseResponse() {
        this._src.pause();
        this._isResponsePaused = true;
    }

    _resumeResponse() {
        this._src.resume();
        this._isResponsePaused = false;
    }

    /**
     * @param {buffer|string} data - The data to send.
     * @returns {Session}
     */
    async clientRequestWrite(data) {
        return socketWrite(this._dst, data);
    }

    /**
     * @param {buffer|string} data - The data to send.
     * @returns {Session}
     */
    async clientResponseWrite(data) {
        return socketWrite(this._src, data);
    }

    /**
     * Destroy existing sockets for this Session-Instance
     * @returns {Session}
     */
    destroy() {
        if (this._dst) {
            socketDestroy(this._dst);
        }
        if (this._src) {
            socketDestroy(this._src);
        }
        return this;
    }

    /**
     * Is Session authenticated by user
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.authenticated;
    }

    /**
     * Set the socket that will receive response
     * @param {net.Socket} socket
     * @returns {Session}
     */
    setResponseSocket(socket) {
        this._src = socket;
        return this;
    }

    /**
     * Set the socket that will receive request
     * @param {net.Socket} socket
     * @returns {Session}
     */
    setRequestSocket(socket) {
        this._dst = socket;
        return this;
    }

    /**
     * Get own id
     * @returns {string}
     */
    getId() {
        return this._id;
    }

    set request(buffer) {
        if (!this.isHttps || this._updated) {  //parse only if data is not encrypted
            const parsedRequest = parseDataToObject(buffer, null, this._requestCounter > 0);
            const body = parsedRequest.body;
            delete parsedRequest.body;

            ++this._requestCounter;
            if (parsedRequest.headers) {
                this._request = parsedRequest;
            }
            if (this._request.method === HTTP_METHODS.CONNECT) { //ignore CONNECT method
                --this._requestCounter;
            }

            if (body) {
                this._request.body = (this._request.body || '') + body;
            }
        }

        return this._request;
    }

    get request() {
        return this._request;
    }

    set response(buffer) {
        if (!this.isHttps || this._updated) { //parse only if data is not encrypted
            const parsedResponse = parseDataToObject(buffer, true, this._responseCounter > 0);

            if (!parsedResponse.headers) {
                this.rawResponse = buffer; //pushing whole buffer, because there aren't headers here
            }
            else {
                //found body from buffer without converting
                const DOUBLE_CRLF = CRLF + CRLF;
                const splitAt = buffer.indexOf(DOUBLE_CRLF, 0);
                this.rawResponse = buffer.slice(splitAt + DOUBLE_CRLF.length);
            }

            ++this._responseCounter;
            this._response = Object.assign({}, this._response, parsedResponse);

            if(this._response?.statusCode > 300
                && this._response?.statusCode < 400) {
                //redirects will use same session to do next requests
                --this._requestCounter;
                --this._responseCounter;
            }

            if (this._response?.headers?.[CONTENT_LENGTH] && this._response?.body) {
                const bodyBytes = Buffer.byteLength(this._response.body);
                this._response.complete = parseInt(this._response.headers[CONTENT_LENGTH]) <= bodyBytes;
            }
            if (this._response?.headers?.[TRANSFER_ENCODING] === CHUNKED && this._response?.body) {
                this._response.complete = buffer.indexOf(ZERO + CRLF + CRLF) > -1;
            }
        }
        return this._response;
    }

    set rawResponse(buffer) {
        if(this._responseCounter === 0) {
            this._rawResponseBodyChunks = []; //need to reset all possible body-chunks
        }
        const bufferToPush = Buffer.from(buffer, BINARY_ENCODING);
        const splitAt = bufferToPush.indexOf(CRLF);
        if (splitAt > -1) {
            // handling transfer-encoding: chunked
            // each chunk contains info like:
            // chunk length in hex\r\n
            // chunk\r\n
            const [chunkLengthHex, chunk] = [bufferToPush.slice(0, splitAt), bufferToPush.slice(splitAt + CRLF.length)];
            const chunkLength = parseInt(chunkLengthHex, 16);
            if (Number.isInteger(chunkLength)
                && chunkLength !== 0) {
                const [thisChunk, nextChunk] = [chunk.slice(0, chunkLength), chunk.slice(chunkLength + CRLF.length)];
                this._rawResponseBodyChunks.push(thisChunk);
                if (nextChunk.length > 0) {
                    return this.rawResponse = nextChunk; //process next chunk in recursion
                }
            }
            else if(!Number.isInteger(chunkLength)) {
                return this.rawResponse = chunkLengthHex; //valid chunk is what we think could be the hex-number
            }
            return; //go out from this function
        }
        this._rawResponseBodyChunks.push(bufferToPush);
    }

    get rawResponse() {
        return Buffer.concat(this._rawResponseBodyChunks);
    }

    get response() {
        return Object.assign({}, this._response, {body: this.rawResponse.toString()});
    }

    /**
     * @param {string} username
     * @returns {Session}
     */
    setUserAuthentication(username) {
        if (username) {
            this.authenticated = true;
            this.user = username;
        }
        return this;
    }

    /**
     * @param {object} options
     * @returns {Session}
     */
    setTunnelOpt(options) {
        if (options) {
            const {host, port, upstream} = options;
            this._tunnel.ADDRESS = host;
            this._tunnel.PORT = port;
            if (!!upstream) {
                this._tunnel.UPSTREAM = upstream;
            }
        }
        return this;
    }

    /**
     * @param {object} callbacksObject
     * @param {Function} callbacksObject.onDataFromClient
     * @param {Function} callbacksObject.onDataFromUpstream
     * @param {Function} callbacksObject.onClose
     * @param {Function} callbacksObject.handleSni
     * @param {object} KEYS - {key:{string},cert:{string}}
     * @returns {Session}
     * @private
     */
    _updateSockets(callbacksObject, KEYS = DEFAULT_KEYS) {
        const {onDataFromClient, onDataFromUpstream, onClose, handleSni} =
            callbacksObject;

        if (!this._updated) {
            const srcSocket = new tls.TLSSocket(this._src, {
                rejectUnauthorized: false,
                requestCert: false,
                isServer: true,
                ...(!handleSni && {
                    key: KEYS.key,
                    cert: KEYS.cert,
                }),
                SNICallback: handleSni,
            })
                .on(DATA, onDataFromClient)
                .on(CLOSE, onClose)
                .on(ERROR, onClose);

            this.setResponseSocket(srcSocket);

            const dstSocket = new tls.TLSSocket(this._dst, {
                rejectUnauthorized: false,
                requestCert: false,
                isServer: false
            })
                .on(DATA, onDataFromUpstream)
                .on(CLOSE, onClose)
                .on(ERROR, onClose);
            // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L976
            // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L1675-L1686
            dstSocket.setServername(this?._tunnel?.UPSTREAM?.host || this._dst._host);
            this.setRequestSocket(dstSocket);
            this._updated = true;
        }
        return this;
    }

    /**
     * Get Stats for this tunnel
     * @returns {object} - {ADDRESS:'String', PORT:Number, UPSTREAM:{ADDRESS,PORT}}
     */
    getTunnelStats() {
        return this._tunnel;
    }
}

module.exports = Session;
