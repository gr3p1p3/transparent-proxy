import { startProxy } from "../src/ProxyServer";
import { proxyRequest } from "./util";

describe("HTTP Proxy", () => {
  it("should forward headers", async () => {
    const server = await startProxy(8888, { verbose: true }, () => {
      console.log("Started Proxy");
    });

    const result = await proxyRequest({ "x-baz": "qux" });
    expect(result.headers['x-baz']).toBe('qux')

    await server.stop(() => console.log("Stopped Proxy"));
  });
});
