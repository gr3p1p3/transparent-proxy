import tls, { SecureContext } from "tls";
import net, { Socket } from "net";
import { CONSTANTS } from "../lib/constants";
const { DEFAULT_KEYS } = CONSTANTS;
const { CLOSE, DATA, ERROR } = CONSTANTS.EVENTS;
import { parseDataToObject } from "../lib/";
import { HttpMessage, Tunnel } from "../types";
import crypto from 'crypto';
import fs from 'fs'
import forge from 'node-forge';
/**
 * Write data of given socket
 * @param {net.Socket} socket
 * @param data
 */
function socketWrite(socket: Socket, data: string | Buffer) {
  if (socket && !socket.destroyed && data) {
    socket.write(data);
  }
}

/**
 * Destroy the socket
 * @param {net.Socket} socket
 */
function socketDestroy(socket: Socket) {
  if (socket && !socket.destroyed) {
    socket.destroy();
  }
}

type Callbacks = {
  onDataFromClient: (...args: any[]) => void; // ses net.Socket.on
  onDataFromUpstream: (...args: any[]) => void; // ses net.Socket.on
  onClose: (...args: any[]) => void; // ses net.Socket.on
};
export class Session {
  private _id: string;
  private _src: Socket | null;
  private _dst: Socket | null;
  private _tunnel: Tunnel;
  private _updated: boolean;
  user: string | null;
  authenticated: boolean;
  isHttps: boolean;
  private _request: Buffer | HttpMessage | undefined;
  private _response: Buffer | undefined;

  constructor(id: string) {
    this._id = id;
    this._src = null;
    this._dst = null;
    this.user = null;
    this.authenticated = false;
    this.isHttps = false;
    this._updated = false;
  }

  clientRequestWrite(data: Buffer) {
    if (!this._dst) {
      throw new Error(
        "Destination socket not available. This should not happen."
      );
    }
    socketWrite(this._dst, data);
    return this;
  }

  clientResponseWrite(data: string) {
    if (!this._src) {
      throw new Error(
        "Destination socket not available. This should not happen."
      );
    }
    socketWrite(this._src, data);
    return this;
  }

  destroy() {
    if (this._dst) {
      socketDestroy(this._dst);
    }
    if (this._src) {
      socketDestroy(this._src);
    }
    return this;
  }

  isAuthenticated() {
    return this.authenticated;
  }

  setResponseSocket(socket: Socket) {
    this._src = socket;
    return this;
  }

  setRequestSocket(socket: Socket) {
    this._dst = socket;
    return this;
  }

  getId() {
    return this._id;
  }

  get updated(): boolean {
    return this._updated;
  }

  setRequest(buffer: Buffer) {
    const parsedRequest = parseDataToObject(buffer);
    if (parsedRequest.headers) {
      this._request = parsedRequest;
    }
    //@ts-ignore setter cannot return; FIXME
    return this._request;
  }

  getRequest(): HttpMessage {
    //@ts-ignore _req could be {} here; FIXME
    return this._request;
  }

  set response(buffer: Buffer) {
    // const indexOfChunkEnd = buffer.toString().indexOf(LF + CRLF);
    // this._response.complete = indexOfChunkEnd; //TODO find a way to recognize last chunk

    const parsedResponse = parseDataToObject(
      buffer,
      true,
      //@ts-ignore request can be Buffer, HttpMessage or undefined. This needs to
      //be cleaned up; FIXME
      !!this._response?.body
    );
    //@ts-ignore request can be Buffer, HttpMessage or undefined. This needs to
    //be cleaned up; FIXME
    if (this._response?.body && parsedResponse.body) {
      //@ts-ignore request can be Buffer, HttpMessage or undefined. This needs to
      //be cleaned up; FIXME
      parsedResponse.body = this._response.body + parsedResponse.body;
    }
    //@ts-ignore request can be Buffer, HttpMessage or undefined. This needs to
    //be cleaned up; FIXME
    this._response = { ...this._response, ...parsedResponse };
    //@ts-ignore setter cannot return; FIXME
    return this._response;
  }

  get response() {
    //@ts-ignore request can be Buffer, HttpMessage or undefined. This needs to
    //be cleaned up; FIXME
    return this._response;
  }


  setUserAuthentication(username: string) {
    if (username) {
      this.authenticated = true;
      this.user = username;
    }
    return this;
  }

  setTunnelOpt(options: {
    host: string;
    port: number;
    upstream: { host: string; port: number };
  }) {
    if (options && this._tunnel) {
      const { host, port, upstream } = options;
      this._tunnel.ADDRESS = host;
      this._tunnel.PORT = port;
      if (!!upstream) {
        this._tunnel.UPSTREAM = upstream;
      }
    }
    return this;
  }

  _updateSockets(callbacksObject: Callbacks, KEYS = DEFAULT_KEYS): Session {
    const { onDataFromClient, onDataFromUpstream, onClose } = callbacksObject;
    KEYS = KEYS || DEFAULT_KEYS;

    if (!this._updated && this._src) {
      const srcSocket = new tls.TLSSocket(this._src, {
        rejectUnauthorized: false,
        requestCert: false,
        isServer: true,

        SNICallback: (hostname: string, callback: (error: any, context?: SecureContext) => void) => {
          console.info("in sni callback for", hostname)
          //TODO: implement building dynamic cert using node-forge here
          try {
            const hash = forge.md.md5.create();
            hash.update(hostname);

            const validityDays = 365 * 5;

            const proxyCert = forge.pki.createCertificate();
            const caCertPem = fs.readFileSync('./certs/ca.cert').toString()
            const caCert = forge.pki.certificateFromPem(caCertPem)
            const caPrvKeyPem = fs.readFileSync('./certs/ca.key').toString()
            const caKey = forge.pki.privateKeyFromPem(caPrvKeyPem)
            const caPubKeyPem = fs.readFileSync('./certs/ca_pub.key').toString()
            const serverPrvKeyPem = fs.readFileSync('./certs/server.key').toString()
            const serverPubKeyPem = fs.readFileSync('./certs/server_pub.key').toString()

            // Must match the issuer attributes excluding CN
            const issuerAttrs = [
              {
                name: 'countryName',
                value: 'DK',
              },
              {
                name: 'organizationName',
                value: 'Dixa ApS',
              },
              {
                name: 'organizationalUnitName',
                value: 'partnerships',
              },
            ]
            proxyCert.publicKey = forge.pki.publicKeyFromPem(serverPubKeyPem)
            proxyCert.serialNumber = hash.digest().toHex()
            var now = Date.now();
            proxyCert.validity.notBefore = new Date(now - 24 * 60 * 60 * 1000); // 1 day before
            proxyCert.validity.notAfter = new Date(now + 824 * 24 * 60 * 60 * 1000); // 824 days after
           proxyCert.setIssuer(caCert.subject.attributes)
            proxyCert.setSubject([
               ...issuerAttrs,
              {
                name: 'commonName',
                value: hostname,
              },
            ]);
            proxyCert.setExtensions([
              { name: 'basicConstraints', cA: false },{
              name: 'subjectAltName',
              altNames: [{ type: 2, value: hostname }]
            }])
            proxyCert.sign(caKey,forge.md.sha256.create())
            const key = serverPrvKeyPem
            const cert = forge.pki.certificateToPem(proxyCert)
            fs.writeFileSync(`./certs/${hostname}.cert`, cert)
            const ctx = tls.createSecureContext({
              key,
              cert})
  
            callback(null, ctx)
          } catch (err: unknown) {
            console.error(err)
            callback(err)
          }
          
        }
      })
        .on(DATA, onDataFromClient)
        .on(CLOSE, onClose)
        .on(ERROR, onClose);

      this.setResponseSocket(srcSocket);
      if (!this._dst) {
        throw new Error("Destination socket not set. This should not happen.");
      }

      const dstSocket = new tls.TLSSocket(this._dst, {
        rejectUnauthorized: false,
        requestCert: false,
        isServer: false,
      })
        .on(DATA, onDataFromUpstream)
        .on(CLOSE, onClose)
        .on(ERROR, onClose);
      // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L976
      // https://github.com/nodejs/node/blob/7f7a899fa5f3b192d4f503f6602f24f7ff4ec57a/lib/_tls_wrap.js#L1675-L1686
      //dstSocket.setServername(this._dst._host || this._tunnel?.UPSTREAM.host);
      this.setRequestSocket(dstSocket);
      this._updated = true;
    }
    return this;
  }

  getTunnelStats() : Tunnel {
    return this._tunnel;
  }

  get dst() {
    return this._dst;
  }
}
