const isFunction = require('./isFunction');

module.exports = function usingUpstreamToProxy(upstream, {data, bridgedConnection, remoteID}) {
    if (isFunction(upstream)) {
        const returnValue = upstream(data, bridgedConnection, remoteID);
        if (returnValue !== 'localhost') {
            return returnValue;
        }
    }

    return false;
};