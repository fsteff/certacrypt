const hypercore = require('hypercore')
const wrap = require('../index')
const tape = require('tape')
const ram = require('random-access-memory')

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
