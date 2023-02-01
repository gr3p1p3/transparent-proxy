import http from "http";
import url from "url";
import { port as apiPort } from "./setup";

import { HttpProxyAgent } from "http-proxy-agent";

const proxyPort = process.env.TP_PORT || 8888;
const proxyAgent = new HttpProxyAgent(`http://localhost:${proxyPort}`);

export const proxyRequest = async (
  headers: Record<string, string>,
  path?: string
): Promise<any> =>
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
