import net from "net";
import { onConnectedClientHandling } from "./core";
import { DefaultLogger } from "./lib";

import { CONSTANTS } from './lib'
import { ProxyServerOptions } from "./types";

export class ProxyServer extends net.Server {
    private bridgedConnections;
  constructor(options: ProxyServerOptions) {
    const {
      upstream,
      tcpOutgoingAddress,
      verbose,
      injectData,
      injectResponse,
      auth,
      intercept,
      keys,
    } = { ...CONSTANTS.DEFAULT_OPTIONS, ...options }; //merging with default options
    const logger = new DefaultLogger(verbose ? "debug" : "warn");
    const bridgedConnections = {};

    super(function (clientSocket: net.Socket) {
      onConnectedClientHandling(
        clientSocket,
        bridgedConnections,
        {
          upstream,
          tcpOutgoingAddress,
          injectData,
          injectResponse,
          auth,
          intercept,
          keys,
        },
        logger
      );
    });
    this.bridgedConnections = bridgedConnections;
  }

  getBridgedConnections() {
    return this.bridgedConnections;
  }
}
