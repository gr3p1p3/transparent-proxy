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
            auth, intercept, keys,
            handleSni, logger
        } = {...DEFAULT_OPTIONS, ...options}; //merging with default options
        const bridgedConnections = {};

        super(function (clientSocket) {
            onConnectedClientHandling(
                clientSocket,
                bridgedConnections,
                {
                    upstream, tcpOutgoingAddress,
                    injectData, injectResponse,
                    auth, intercept, keys,
                    handleSni,

                },
                logger || new Logger(verbose) )
        });
        this.bridgedConnections = bridgedConnections;

        //TODO this is an horrible workaround, but extending doesn't work
        this.getBridgedConnections = function _getBridgedConnections() {
            return this.bridgedConnections;
        }
    }

    //TODO why doesnt work?
    getBridgedConnections() {
        return this.bridgedConnections;
    };
}

module.exports = ProxyServer;