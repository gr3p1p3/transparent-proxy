import { isFunction } from './isFunction.js';

function usingUpstreamToProxy(upstream, {data, bridgedConnection}) {
    if (isFunction(upstream)) {
        const returnValue = upstream(data, bridgedConnection);
        if (returnValue !== 'localhost') {
            return returnValue;
        }
    }
    return false;
};

export { usingUpstreamToProxy };
