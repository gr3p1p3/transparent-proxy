module.exports = {
    DEFAULT_OPTIONS: {
        upstream: false,
        tcpOutgoingAddress: false,
        verbose: false,
        injectData: false,
        injectResponse: false,
        auth: false
    },
    EVENTS: {
        CLOSE: 'close',
        DATA: 'data',
        ERROR: 'error',
        EXIT: 'exit',
    },
    ERROR_CODES: {
        ETIMEDOUT: 'ETIMEDOUT',
        ENOTFOUND: 'ENOTFOUND'
    },
    HTTP: 'http',
    HTTPS: 'https',
    HTTP_PORT: 80,
    HTTPS_PORT: 443,
    HTTP_BODIES: {
        AUTH_REQUIRED: 'Proxy Authorization Required!',
        NOT_FOUND: 'Not Found!'
    },
    HTTP_RESPONSES: {
        OK: 'HTTP/1.0 200 OK',
        NOT_FOUND: 'HTTP/1.0 404 Not Found',
        NOT_OK: 'HTTP/1.0 400 Bad Request',
        AUTH_REQUIRED: 'HTTP/1.0 407 Proxy Authorization Required'
            + '\r\nProxy-Authenticate: Basic realm=""',
        TIMED_OUT: 'HTTP/1.0 408 Request Timeout'
    },
    HTTP_METHODS: {
        CONNECT: 'CONNECT',
        GET: 'GET',
    },
    STRINGS: {
        AT: '@',
        BLANK: ' ',
        CLRF: '\r\n',
        EMPTY: '',
        SEPARATOR: ':',
        PROXY_AUTH: 'Proxy-Authorization',
        PROXY_AUTH_BASIC: 'Basic',

    },
    SLASH_REGEXP: /\//gmi
};