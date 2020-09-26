const hypertrie = require('hypertrie')
const wrap = require('../index')
const tape = require('tape')
const ram = require('random-access-memory')
const primitives = require('../../crypto/lib/primitives')

function replicate (a, b, opts) {
  var stream = a.replicate(true, opts)
  return stream.pipe(b.replicate(false, opts)).pipe(stream)
}

tape('basic', t => {
  const key = primitives.generateEncryptionKey()

  function encrypt (data) {
    return primitives.decryptBlob(data, key)
  }

  function decrypt (data) {
    return primitives.decryptBlob(data, key)
  }

  t.plan(1)
  const trie = wrap(hypertrie(ram, null, { valueEncoding: 'binary' }), encrypt, decrypt)
  trie.on('ready', put)

  function put () {
    trie.put('hello', Buffer.from('world', 'utf-8'), null, read)
  }

  function read () {
    trie.get('hello', (err, data) => {
      t.error(err)
      t.same(data.toString('utf-8'), 'hello')
    })
  }
})
