export type ProxyError = {
  cause?: unknown;
  code: unknown;
}

export type ProxyServerOptions = {
  upstream? : any;
  tcpOutgoingAddress? : any;
  verbose? : boolean;
  injectData? : any;
  injectResponse? : any;
  auth? : any;
  intercept? : any;
  keys? : any;
};

export type HttpMethod =
  | "HEAD"
  | "OPTIONS"
  | "GET"
  | "PATCH"
  | "PUT"
  | "POST"
  | "DELETE"
  | "CONNECT";

export type HttpMessage = {
  method: HttpMethod;
  path: string;
  version: string;
  headers: { [key: string]: string };
  body: any;
};

export type Tunnel =
  | {
      ADDRESS: string;
      PORT: number;
      UPSTREAM: {
        host: string;
        port: number;
      };
    }
  | undefined;
