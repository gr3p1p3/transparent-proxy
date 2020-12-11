module.exports = class Logger {
    constructor(debugMode = false) {
        this.debug = debugMode;
    }

    log(args) {
        if (this.debug) {
            console.log('###', new Date(), ...arguments);
        }
    }

    error(args) {
        if (this.debug) {
            console.error('###', new Date(), ...arguments);
        }
    }
};