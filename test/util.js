const http = require("http");
const url = require("url");

const HttpProxyAgent = require("http-proxy-agent");
const ProxyServer = require("../ProxyServer");

const apiPort = process.env.TP_MOCK_PORT || 9876;
const proxyPort = process.env.TP_PORT || 8888;
const proxyAgent = new HttpProxyAgent(`http://localhost:${proxyPort}`);

/**
 * Used in tests to make requests against a mock http server.
 * The request always returns an object containing details about the received
 * request for inspection/assertions.
 * 
 * @see setup.js
 * 
 * @param { Record<string, string> } headers 
 * @param { string? } path 
 * @returns { Promise<{
                method: string,
                protocol: string,
                version: string,
                host: string,
                headers: Record<{string, string}>,
                path: string,
                query: string,
                body: string
      }> }
 */
const proxyRequest = async (headers, path) =>
  new Promise((resolve, reject) => {
    try {
      http.get(
        {
          ...url.parse(`http://localhost:${apiPort}/${path}`),
          agent: proxyAgent,
          headers,
        },
        (response) => {
          let data = Buffer.from([]);
          response.on("data", (chunk) => (data = Buffer.concat([data, chunk])));
          response.on("end", () => resolve(JSON.parse(data?.toString())));
          response.on("error", (err) => reject(err));
        }
      );
    } catch (err) {
      reject(err);
    }
  });

/**
 *
 * @param {int} port
 * @param {ProxyServer Options} options
 * @param {callback} onStarted
 * @returns {Promise<ProxyServer>}
 */
const startProxy = (port, options = {}, onStarted) =>
  new Promise((resolve, reject) => {
    try {
      const proxy = new ProxyServer(options);
      const server = proxy.listen(port, () => {
        onStarted && onStarted();
        resolve(server);
      });
    } catch (err) {
      reject(err);
    }
  });

/**
 * Closes the given server and executes the (optional) callback when done.
 *
 * @param {ProxyServer} server
 * @param {function?} callback
 * @returns void
 */
const stopProxy = (server, callback) => {
  return new Promise((resolve, reject) => {
    try {
      server?.close(() => {
        callback && callback();
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  proxyRequest,
  startProxy,
  stopProxy,
};
