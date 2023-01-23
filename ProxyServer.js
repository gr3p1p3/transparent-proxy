const net = require('net');

const onConnectedClientHandling = require('./core/onConnectedClientHandling');
const Logger = require('./lib/Logger');

const {DEFAULT_OPTIONS} = require('./lib/constants');


class ProxyServer extends net.createServer {
    constructor(options) {
        const {
            upstream, tcpOutgoingAddress,
            verbose,
            injectData, injectResponse,
            auth, intercept, keys, logger
        } = {...DEFAULT_OPTIONS, ...options}; //merging with default options
        const bridgedConnections = {};

        super(function (clientSocket) {
            onConnectedClientHandling(
                clientSocket,
                bridgedConnections,
                {
                    upstream, tcpOutgoingAddress,
                    injectData, injectResponse,
                    auth, intercept, keys
                },
                logger || new Logger(verbose) )
        });
        this.bridgedConnections = bridgedConnections;
    }

    getBridgedConnections() {
        return this.bridgedConnections;
    };
}

module.exports = ProxyServer;