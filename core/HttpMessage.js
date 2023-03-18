const {STRINGS, HTTP_METHODS} = require('../lib/constants');
const parseDataToObject = require('../lib/parseDataToObject');
const {CRLF} = STRINGS;


class HttpMessage extends Object {
    constructor() {
        super();
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
            this._body.raw = buffer; //pushing whole buffer, because there aren't headers here
        }
        else {
            //found body from buffer without converting
            const DOUBLE_CRLF = CRLF + CRLF;
            const splitAt = buffer.indexOf(DOUBLE_CRLF, 0);

            this._headers.raw = parsedData.headers; //TODO make something like body => buffer.slice(0,splitAt);
            this._body.raw = buffer.slice(splitAt + DOUBLE_CRLF.length);
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

        this._data = {};
    }

    parseData(buffer) {
        const parsedRequest = super.parseData(buffer);

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

    parseData(buffer) {
        const parsedResponse = super.parseData(buffer, true);

        // TODO this will not work for every response
        if (this._data.headers['content-length'] && this.body) {
            const bodyBytes = Buffer.byteLength(this.body);
            this.complete = parseInt(this._data.headers['content-length']) <= bodyBytes;
        }

        return this.toObject();
    }
}

class Headers extends Object {
    constructor() {
        super();
        this._raw = {}; //TODO empty Buffer as Default
    }

    set raw(object) {
        this._raw = {...this._raw, ...object};
        return this;
    }

    toObject() {
        return this._raw;
    }
}

class Body extends Object {
    constructor() {
        super();
        this._rawChunks = [];
    }

    set raw(buffer) {
        this._rawChunks.push(buffer);
        return this;
    }

    get raw() {
        return Buffer.concat(this._rawChunks);
    }

    toString() {
        return this.raw.toString();
    }
}

module.exports = {Request, Response};