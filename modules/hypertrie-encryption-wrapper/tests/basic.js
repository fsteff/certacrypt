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
    return primitives.encryptBlob(data, key)
  }

  function decrypt (data) {
    return primitives.decryptBlob(data, key)
  }

  t.plan(2)
  const trie = wrap(hypertrie(ram, null, { valueEncoding: 'utf-8' }), encrypt, decrypt)
  trie.put('hello', 'world', null, read)

  function read () {
    trie.get('hello', (err, data) => {
      t.error(err)
      t.same('world', data.value)
    })
  }
})

tape('replace', t => {
  const key = primitives.generateEncryptionKey()

  function encrypt (data) {
    return primitives.encryptBlob(data, key)
  }

  function decrypt (data) {
    return primitives.decryptBlob(data, key)
  }

  t.plan(4)
  const trie = wrap(hypertrie(ram, null, { valueEncoding: 'utf-8' }), encrypt, decrypt)
  trie.put('hello', 'world', null, replace)

  function replace () {
    trie.put('hello', 'hypertrie', {
      condition: (o, n, cb) => {
        cb(null, o.value === 'world')
      }
    }, test('hypertrie', noReplace))
  }

  function noReplace () {
    trie.put('hello', 'not', {
      condition: (o, n, cb) => {
        cb(null, o.value !== 'hypertrie')
      }
    }, test('hypertrie'))
  }

  function test (target, next) {
    return function () {
      trie.get('hello', (err, data) => {
        t.error(err)
        t.same(target, data.value)
        if (next) next()
      })
    }
  }
})

tape('replicate', t => {
  const key = primitives.generateEncryptionKey()

  function encrypt (data) {
    return primitives.encryptBlob(data, key)
  }

  function decrypt (data) {
    return primitives.decryptBlob(data, key)
  }

  t.plan(4)
  const trie = wrap(hypertrie(ram, null, { valueEncoding: 'utf-8' }), encrypt, decrypt)
  trie.put('hello', 'world', null, read)

  function read () {
    trie.get('hello', (err, data) => {
      t.error(err)
      t.same('world', data.value)
      repl()
    })
  }

  function repl () {
    const clone = wrap(hypertrie(ram, trie.key, { valueEncoding: 'utf-8', alwaysUpdate: true }), encrypt, decrypt)
    replicate(trie, clone, { live: true, download: true })

    clone.get('hello', (err, data) => {
      t.error(err)
      t.same('world', data.value)
    })
  }
})
