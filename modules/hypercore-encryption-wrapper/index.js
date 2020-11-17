const codecs = require('codecs')
const bulk = require('bulk-write-stream')

module.exports = wrapHypercore

/**
 * Wraps an existing hypercore feed (or RemoteHypercore pendant)
 * @param {Hypercore} feed
 * @param {(data: Buffer, index: number) => Buffer} encrypt encryption function
 * @param {(data: Buffer, index: number) => Buffer} decrypt decryption function
 */
function wrapHypercore (feed, encrypt, decrypt) {
  const oldAppend = feed.append
  const oldGet = feed.get
  // const oldGetBatch = feed.getBatch

  if (feed.hasCertaCryptWrapper) {
    // seems the corestore does some sort of deduplication, this is only a dirty fix
    console.warn('feed already has a wrapper: ' + feed.key.toString('hex'))
    return feed
  }
  feed.hasCertaCryptWrapper = true

  feed.append = append
  feed.get = get
  feed.getBatch = () => { throw new Error('getBatch is not yet implemented!') }
  feed.createWriteStream = createWriteStream

  const passThroughCodec = {
    encode: buf => buf,
    decode: buf => buf
  }

  let codec = null
  if (typeof feed._codec === 'object') {
    codec = feed._codec
    feed._codec = passThroughCodec
  } else if (feed.valueEncoding && typeof feed.valueEncoding === 'object') {
    codec = feed.valueEncoding
    feed.valueEncoding = passThroughCodec
  } else if (feed.valueEncoding && typeof feed.valueEncoding === 'string') {
    codec = codecs(feed.valueEncoding)
    feed.valueEncoding = passThroughCodec
  } else {
    codec = passThroughCodec
  }
  const encode = codec.encode
  const decode = codec.decode

  const pendigAppends = []

  return feed

  function append (batch, cb) {
    batch = Array.isArray(batch) ? batch : [batch]
    cb = typeof cb === 'function' ? cb : defaultCallback

    // in order for feed.length to be correct, there must not be any pending append calls
    if (pendigAppends.length === 0) {
      pendigAppends.push(appendWhenReady)
      appendWhenReady()
    } else {
      pendigAppends.push(appendWhenReady)
    }

    function appendWhenReady () {
      try {
        const index = feed.length
        for (let i = 0; i < batch.length; i++) {
          const buf = encode(batch[i])
          batch[i] = encrypt(buf, index + i)
        }
        return oldAppend.call(feed, batch, done)
      } catch (err) {
        done(err)
      }

      function done (err) {
        pendigAppends.splice(0, 1)
        if (pendigAppends.length > 0) {
          pendigAppends[0]()
        }

        return cb(err)
      }
    }

    function defaultCallback (err) {
      if (err) throw err
    }
  }

  function get (index, opts, cb) {
    return oldGet.call(feed, index, opts, onData)

    function onData (err, data, isCascaded) {
      if (err) return cb(err)
      // little hacky bugfix: oldGet.call may call get() with onData as callback
      if (isCascaded) return cb(err, data, isCascaded)

      try {
        const plaintext = decrypt(data, index)
        return cb(null, decode(plaintext), true)
      } catch (err) {
        return cb(err)
      }
    }
  }

  function createWriteStream (opts) {
    return bulk.obj(writeEncr)

    function writeEncr (batch, cb) {
      feed.append(batch, cb)
    }
  }
}
