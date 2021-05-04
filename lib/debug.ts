let debuggingEnabled = false

export function debug(msg: string) {
    if(debuggingEnabled) {
        console.debug(`DEBUG [${time()}]: ${msg}`)
    }
}

export function enableDebugLogging() {
    debuggingEnabled = true
}

function time() {
    const d = new Date()
    return d.getHours() + ':' + lpad2(d.getMinutes()) + ':' + lpad2(d.getSeconds()) + '+' + lpad3(d.getMilliseconds())
}

function lpad2(num: number) {
    if(num < 10) return '0' +  num
    else return '' + num
}

function lpad3(num: number) {
    if(num < 10) return '00' +  num
    else if (num < 100) return '0' + num
    else return '' + num
}