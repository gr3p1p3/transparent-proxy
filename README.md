# Intro

**transparent-proxy** extends the native [net.createServer](https://nodejs.org/api/net.html#net_net_createserver_options_connectionlistener) and it acts as a http-proxy (Think like Squid).


This module was built on top of TCP-level to avoid header-stripping problem of nodejs http(s)-modules. 

 
# Quick Start

## Install

```bash
npm i transparent-proxy
```

## Use

```javascript
const ProxyServer = require('transparent-proxy');

//init ProxyServer
const server = new ProxyServer();

//starting server on port 8080
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});
```

## Options Object

| Param  | Type                | Description  |
| ------ | ------------------- | ------------ |
|options | <code>Object</code> |  The options object. |
|[options.upstream] | <code>Function</code> |  The proxy to be used to upstreaming requests. |
|[options.tcpOutgoingAddress] | <code>Function</code> |  The localAddress to use while sending requests |

## getBridgedConnections()

```javascript
const ProxyServer = require('transparent-proxy');
const server = ProxyServer();

//starting server on port 8080
server.listen(8080, '0.0.0.0', function () {
    console.log('Proxy-Server started!', server.address());
});

setInterval(function showOpenSockets() {
    const bridgedConnections = server.getBridgedConnections();
    console.log([new Date()], 'OPEN =>', Object.keys(bridgedConnections).length)
}, 2000);
```

## `upstream` & `tcpOutgoingAddress` Options

The options are functions having follow parameters:

| Param  | Type                | Description  |
| ------ | ------------------- | ------------ |
|data | <code>Buffer</code> |  The received data. |
|bridgedConnection | <code>Socket</code> |  The socket instance |
|bridgedConnectionId | <code>String</code> |  The id of connection `IP:PORT`. |

- upstream-Function need to return a String with format -> IP:PORT of used http-proxy. If 'localhost' is returned, then the host-self will be used as proxy.
- tcpOutgoingAddress-Function need to return a String with format -> IP. 

These functions will be executed before first tcp-socket-connection is established.

## Upstream to other proxy

If you don't want to use the host of active instance self, then you need to upstream connections to another http-proxy.
This can be done with `upstream` attribute.

```javascript
const ProxyServer = require('transparent-proxy');

const server = ProxyServer({
    upstream: function () {
          return 'x.x.x.x:3128'; // upstream to other proxy
    }
});

//starting server on port 8080
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});
```

## Examples

This example upstreams only requests for ifconfig.me to another proxy, for all other requests will be used localhost.

```javascript
const ProxyServer = require('transparent-proxy');

const server = ProxyServer({
    upstream: function (data, bridgedConnection, bridgedConnectionId) {
        if (~(data.toString().indexOf('ifconfig.me'))) {
            return 'x.x.x.x:3128'; // upstream to other proxy
        } else {
            return 'localhost'; //upstream to localhost
        }
    },
});

//starting server on port 8080
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});
```

Testing with `curl`:

```bash
curl -x 127.0.0.1:8080 https://ifconfig.me
x.x.x.x
```
```bash
curl -x 127.0.0.1:8080 https://ifconfig.co
y.y.y.y
```

