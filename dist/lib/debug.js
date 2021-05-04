"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableDebugLogging = exports.debug = void 0;
let debuggingEnabled = false;
function debug(msg) {
    if (debuggingEnabled) {
        console.debug(`DEBUG [${time()}]: ${msg}`);
    }
}
exports.debug = debug;
function enableDebugLogging() {
    debuggingEnabled = true;
}
exports.enableDebugLogging = enableDebugLogging;
function time() {
    const d = new Date();
    return d.getHours() + ':' + lpad2(d.getMinutes()) + ':' + lpad2(d.getSeconds()) + '+' + lpad3(d.getMilliseconds());
}
function lpad2(num) {
    if (num < 10)
        return '0' + num;
    else
        return '' + num;
}
function lpad3(num) {
    if (num < 10)
        return '00' + num;
    else if (num < 100)
        return '0' + num;
    else
        return '' + num;
}
//# sourceMappingURL=debug.js.map