const hyperdrive = require('hyperdrive')
const unixify = require('unixify')
const wrapHyperdrive = require('./drive')

module.exports = async function createFromUrl (url, corestore, context) {
  const parsed = new URL(url)
  const key = Buffer.from(parsed.host, 'hex')
  const id = unixify(parsed.pathname).split('/').slice(0, 2)
  const secret = parsed.searchParams.get('key')

  const drive = hyperdrive(corestore, key)
  await wrapHyperdrive(drive, context, { mainKey: secret, createRoot: false, id: id })
  return drive
}
