module.exports = class Logger {
    constructor(debugMode = false) {
        this.debug = debugMode;
    }

    log(args) {
        if (this.debug) {
            console.log('###', new Date(), ...arguments);
        }
    }
};