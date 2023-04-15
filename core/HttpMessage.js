const {STRINGS, HTTP_METHODS} = require('../lib/constants');
const parseDataToObject = require('../lib/parseDataToObject');
const {CRLF} = STRINGS;


class HttpMessage {
    constructor() {
        this._headers = new Headers();
        this._body = new Body();

        this._data = {};

        this._counter = 0;
        this.complete = false;
    }

    get headers() {
        return this._headers.toObject();
    }

    get body() {
        return this._body.toString();
    }

    parseData(buffer, isResponse = false) {
        const parsedData = parseDataToObject(buffer, isResponse, this._counter > 0);
        ++this._counter;

        if (!parsedData.headers) {
            // this is needed for multiple-chunks request
            this._body.raw = buffer; //pushing whole buffer, because there aren't headers here
        }
        else {
            //found body from buffer without converting
            const DOUBLE_CRLF = CRLF + CRLF;
            const splitAt = buffer.indexOf(DOUBLE_CRLF, 0);

            this._headers.raw = parsedData.headers; //TODO make something like body to save original data of headers => buffer.slice(0,splitAt);
            this._body.raw = buffer.slice(splitAt + DOUBLE_CRLF.length); // push the body-buffer
        }

        delete parsedData.body; // don't need this because it is already parsed

        this._data = {...this._data, ...parsedData};

        return parsedData;
    }


    toObject() {
        return {...this._data, headers: this.headers, body: this.body, counter: this._counter, complete: this.complete};
    }
}

class Request extends HttpMessage {
    constructor(props) {
        super(props);
        this.method = null;
        this.path = null;
        this.version = null;
    }

    parseData(buffer) {
        super.parseData(buffer);

        if (this._data.method === HTTP_METHODS.CONNECT) { //ignore CONNECT method
            --this._counter;
        }

        return this.toObject();
    }
}

class Response
    extends HttpMessage {
    constructor(props) {
        super(props);
        this.version = null;
        this.statusCode = null;
        this.statusText = null;
    }

    /**
     *
     * @param buffer
     * @returns {{headers: *, counter: number, body: *, complete: boolean}}
     */
    parseData(buffer) {
        super.parseData(buffer, true);

        // TODO this will not work for every response
        if (this._data?.headers?.['content-length'] && this.body) {
            const bodyBytes = Buffer.byteLength(this.body);
            this.complete = parseInt(this._data.headers['content-length']) <= bodyBytes;
        }

        return this.toObject();
    }
}

class Headers {
    constructor() {
        this._raw = {}; //TODO empty Buffer as Default
    }

    /**
     * Merge all Headers info in case of multiple requests
     * @param object
     * @returns {Headers}
     */
    set raw(object) {
        this._raw = {...this._raw, ...object}; //TODO handle with buffer instead
        return this;
    }

    /**
     * Get the collected Headers asObject
     * @returns {Object}
     */
    toObject() {
        return this._raw;
    }
}

class Body {
    constructor() {
        this._rawChunks = [];
    }

    /**
     * Push Buffer of Http-Body in case of multiple chunks
     * @param {Buffer} buffer - The buffer of Http-Body
     * @returns {Body}
     */
    set raw(buffer) {
        this._rawChunks.push(buffer);
        return this;
    }

    /**
     * Get the total collected Buffer of Http-Body
     * @returns {Buffer}
     */
    get raw() {
        return Buffer.concat(this._rawChunks);
    }

    /**
     * Get the collected Http-Body as String
     * @returns {string}
     */
    toString() {
        return this.raw.toString();
    }
}

module.exports = {Request, Response};