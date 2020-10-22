const CryptoContext = require('../crypto/lib/Context')
const wrapHypercore = require('../hypercore-encryption-wrapper')

module.exports = function wrapCorestore (corestore, context) {
  const oldGet = corestore.get

  if (!context) context = new CryptoContext()

  corestore.get = get
  return corestore

  function get (...args) {
    const core = oldGet.call(corestore, ...args)
    core.ready((err) => {
      if (err) throw err
      const key = core.key.toString('hex')
      wrapHypercore(core,
        context.getStreamEncryptor(key),
        context.getStreamDecryptor(key)
      )
    })
    return core
  }
}
