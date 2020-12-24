# Intro

**transparent-proxy** extends the native [net.createServer](https://nodejs.org/api/net.html#net_net_createserver_options_connectionlistener) and it acts as a **real** transparent http-proxy.

This module was built on top of TCP-level to avoid header-stripping problem of nodejs http(s)-modules. 

It allows to upstream client-request dynamically to other proxies, or to certain iFace, and more...

It supports [Basic Proxy-Authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Proxy-Authorization).


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
|[options.auth] | <code>Function</code> |  Activate/Handle Proxy-Authentication. Returns or solves to Boolean. |
|[options.upstream] | <code>Function</code> |  The proxy to be used to upstreaming requests. Returns String. |
|[options.tcpOutgoingAddress] | <code>Function</code> |  The localAddress to use while sending requests. Returns String |
|[options.verbose] | <code>Boolean</code> |  Activate verbose mode. |



## `upstream` & `tcpOutgoingAddress` Options

The options are functions having follow parameters:

| Param  | Type                | Description  |
| ------ | ------------------- | ------------ |
|data | <code>Buffer</code> |  The received data. |
|bridgedConnection | <code>Object</code> |  Object containing info/data about Tunnel |


- upstream-Function need to return a String with format -> `IP:PORT` or `USER:PWD@IP:PORT` of used http-proxy. If *'localhost'* is returned, then the host-self will be used as proxy.
- tcpOutgoingAddress-Function need to return a String with format -> `IP`. 


*Note*: These functions will be executed before first tcp-socket-connection is established.



## Upstream to other proxies

If you don't want to use the host of active instance self, then you need to upstream connections to another http-proxy.
This can be done with `upstream` attribute.

```javascript
const ProxyServer = require('transparent-proxy');

const server = new ProxyServer({
    upstream: function () {
          return 'x.x.x.x:3128'; // upstream to other proxy
    }
});

//starting server on port 8080
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});
```


## The `auth` Function

This activate basic authorization mechanism.
The Auth-function will be executed while handling Proxy-Authentications.


 
| Param  | Type                | Description  |
| ------ | ------------------- | ------------ |
|username | <code>String</code> |  The client username. |
|password | <code>String</code> |  The client password |
|bridgedConnection | <code>Object</code> |  Object containing info/data about Tunnel |



*Note*: It needs to return True/False or a **Promise** that resolves to boolean (*isAuthenticated*).


```javascript
const ProxyServer = require('transparent-proxy');

const server = new ProxyServer({
    auth: function (username, password) {
        return username === 'bar' && password === 'foo';
    }
});

//starting server on port 8080
server.listen(8080, '0.0.0.0', function () {
    console.log('TCP-Proxy-Server started!', server.address());
});
```



## .getBridgedConnections()

```javascript
const ProxyServer = require('transparent-proxy');
const server = new ProxyServer();

//starting server on port 8080
server.listen(8080, '0.0.0.0', function () {
    console.log('Proxy-Server started!', server.address());
});

setInterval(function showOpenSockets() {
    const bridgedConnections = server.getBridgedConnections();
    console.log([new Date()], 'OPEN =>', Object.keys(bridgedConnections).length)
}, 2000);
```


## Examples

This example upstreams only requests for ifconfig.me to another proxy, for all other requests will be used localhost.

```javascript
const ProxyServer = require('transparent-proxy');

const server = new ProxyServer({
    upstream: function (data, bridgedConnection) {
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



For more examples [look here](https://github.com/gr3p1p3/transparent-proxy/tree/master/examples).
