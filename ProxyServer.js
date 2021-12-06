import { createServer } from 'net';

import { onConnectedClientHandling } from './core/onConnectedClientHandling.js';
import { Logger } from './lib/Logger.js';

import { DEFAULT_OPTIONS } from './lib/constants.js';


class ProxyServer extends createServer {
    constructor(options) {
        const {
            upstream, tcpOutgoingAddress,
            verbose,
            injectData, injectResponse,
            auth, intercept, keys
        } = {...DEFAULT_OPTIONS, ...options}; //merging with default options
        const logger = new Logger(verbose);
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
                logger)
        });
        this.bridgedConnections = bridgedConnections;
    }

    getBridgedConnections() {
        return this.bridgedConnections;
    };
}

export { ProxyServer };
