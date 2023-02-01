export function isAscii(str: any) {
    if (typeof (str) !== 'string') {
        return false;
    }
    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) > 127) {
            return false;
        }
    }
    return true;
};