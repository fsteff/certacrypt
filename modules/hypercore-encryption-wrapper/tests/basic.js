const hypercore = require('hypercore')
const wrap = require('../index')
const tape = require('tape')
const ram = require('random-access-memory')
const crypto = require('../../crypto/lib/primitives')

function replicate (a, b, opts) {
  var stream = a.replicate(true, opts)
  return stream.pipe(b.replicate(false, opts)).pipe(stream)
}

// pseudo-encryption for testing ;-)
function encrypt (data, index) {
  for (let i = 0; i < data.length; i++) {
    data[i] += (i + index) % 100
  }
  return data
}

function decrypt (data, index) {
  for (let i = 0; i < data.length; i++) {
    data[i] -= (i + index) % 100
  }
  return data
}

tape('basic', t => {
  t.plan(7)
  const core = wrap(hypercore(ram, null, { valueEncoding: 'utf-8' }), encrypt, decrypt)
  core.on('ready', append)

  function append () {
    core.append('hello')
    core.append([' ', 'world'], read)
  }

  function read () {
    t.same(core.length, 3)
    core.get(0, (err, data) => {
      t.error(err)
      t.same(data, 'hello')
    })

    core.get(1, (err, data) => {
      t.error(err)
      t.same(data, ' ')
    })

    core.get(2, (err, data) => {
      t.error(err)
      t.same(data, 'world')
    })
  }
})

tape('stream', t => {
  t.plan(10)
  const core = wrap(hypercore(ram, null, { valueEncoding: 'utf-8' }), encrypt, decrypt)
  core.on('ready', append)

  function append () {
    const stream = core.createWriteStream()
    stream.write('hello')
    stream.write(' ')
    stream.end('world')
    stream.on('finish', read)
  }

  function read () {
    t.same(core.length, 3)
    core.get(0, (err, data) => {
      t.error(err)
      t.same(data, 'hello')
    })

    core.get(1, (err, data) => {
      t.error(err)
      t.same(data, ' ')
    })

    core.get(2, (err, data) => {
      t.error(err)
      t.same(data, 'world')
    })

    const stream = core.createReadStream()
    let i = 0
    stream.on('data', (data) => {
      if (i === 0) t.same(data, 'hello')
      else if (i === 1) t.same(data, ' ')
      else if (i === 2) t.same(data, 'world')
      else t.fail()
      i++
    })
  }
})

tape('replicate', t => {
  t.plan(7)
  const core = wrap(hypercore(ram, null, { valueEncoding: 'utf-8' }), encrypt, decrypt)
  core.on('ready', append)

  function append () {
    core.append('hello')
    core.append([' ', 'world'], copy)
  }
  function copy () {
    const key = core.key
    const clone = wrap(hypercore(ram, key, { valueEncoding: 'utf-8' }), encrypt, decrypt)
    clone.on('ready', () => {
      replicate(core, clone, { live: true, download: true })

      clone.get(0, (err, data) => {
        t.error(err)
        t.same(clone.length, 3)
        t.same(data, 'hello')
      })

      clone.get(1, (err, data) => {
        t.error(err)
        t.same(data, ' ')
      })

      clone.get(2, (err, data) => {
        t.error(err)
        t.same(data, 'world')
      })
    })
  }
})

tape('crypto', t => {
  t.plan(7)
  const key = crypto.generateEncryptionKey()
  const core = wrap(hypercore(ram, null, { valueEncoding: 'utf-8' }),
    (data, idx) => crypto.encryptBlockStream(data, idx, key),
    (data, idx) => crypto.decryptBlockStream(data, idx, key))
  core.on('ready', append)

  function append () {
    core.append('hello')
    core.append([' ', 'world'], read)
  }

  function read () {
    t.same(core.length, 3)
    core.get(0, (err, data) => {
      t.error(err)
      t.same(data, 'hello')
    })

    core.get(1, (err, data) => {
      t.error(err)
      t.same(data, ' ')
    })

    core.get(2, (err, data) => {
      t.error(err)
      t.same(data, 'world')
    })
  }
})
