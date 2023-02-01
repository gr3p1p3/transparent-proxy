import { Server } from "http";
import net from "net";
import { onConnectedClientHandling } from "./core";
import { DefaultLogger } from "./lib";

import { CONSTANTS } from "./lib";
import { ProxyServerOptions } from "./types";

export const startProxy = (
  port: number,
  options: ProxyServerOptions = {},
  onStarted?: () => void
) =>
  new Promise<ProxyServer>((resolve, reject) => {
    try {
      const proxy = new ProxyServer(options);
      const server = proxy.listen(port, () => {
        onStarted && onStarted();
        resolve(server);
      });
    } catch (err: unknown) {
      reject(err);
    }
  });

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

  async stop(callback?: () => void) {
    return new Promise<void>((resolve, reject) => {
      try {
        this.close(() => {
          callback && callback();
          resolve();
        });
      } catch (err: unknown) {
        reject(err);
      }
    });
  }
}
