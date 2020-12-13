module.exports = {
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
    HTTP_RESPONSES: {
        OK: 'HTTP/1.0 200 OK',
        NOT_FOUND: 'HTTP/1.0 404 Not Found',
        NOT_OK: 'HTTP/1.0 400 Bad Request',
        TIMED_OUT: 'HTTP/1.0 408 Request Timeout'
    },
    HTTP_METHODS: {
        CONNECT: 'CONNECT',
        GET: 'GET',
    },
    STRINGS: {
        BLANK: ' ',
        CLRF: '\r\n',
        EMPTY: '',
        SEPARATOR: ':',
    },
    SLASH_REGEXP: /\//gmi
};