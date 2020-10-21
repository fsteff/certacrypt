// This file is auto generated by the protocol-buffers compiler

/* eslint-disable quotes */
/* eslint-disable indent */
/* eslint-disable no-redeclare */
/* eslint-disable camelcase */

// Remember to `npm install --save protocol-buffers-encodings`
var encodings = require('protocol-buffers-encodings')
var varint = encodings.varint
var skip = encodings.skip

var Link = exports.Link = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Directory = exports.Directory = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var File = exports.File = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Stream = exports.Stream = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Share = exports.Share = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Node = exports.Node = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Map_string_bytes = exports.Map_string_bytes = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

defineLink()
defineDirectory()
defineFile()
defineStream()
defineShare()
defineNode()
defineMap_string_bytes()

function defineLink () {
  Link.encodingLength = encodingLength
  Link.encode = encode
  Link.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.id)) throw new Error("id is required")
    var len = encodings.string.encodingLength(obj.id)
    length += 1 + len
    if (!defined(obj.key)) throw new Error("key is required")
    var len = encodings.bytes.encodingLength(obj.key)
    length += 1 + len
    if (defined(obj.name)) {
      var len = encodings.string.encodingLength(obj.name)
      length += 1 + len
    }
    if (defined(obj.url)) {
      var len = encodings.string.encodingLength(obj.url)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.id)) throw new Error("id is required")
    buf[offset++] = 10
    encodings.string.encode(obj.id, buf, offset)
    offset += encodings.string.encode.bytes
    if (!defined(obj.key)) throw new Error("key is required")
    buf[offset++] = 18
    encodings.bytes.encode(obj.key, buf, offset)
    offset += encodings.bytes.encode.bytes
    if (defined(obj.name)) {
      buf[offset++] = 26
      encodings.string.encode(obj.name, buf, offset)
      offset += encodings.string.encode.bytes
    }
    if (defined(obj.url)) {
      buf[offset++] = 34
      encodings.string.encode(obj.url, buf, offset)
      offset += encodings.string.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      id: "",
      key: null,
      name: "",
      url: ""
    }
    var found0 = false
    var found1 = false
    while (true) {
      if (end <= offset) {
        if (!found0 || !found1) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.id = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.key = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        found1 = true
        break
        case 3:
        obj.name = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        break
        case 4:
        obj.url = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineDirectory () {
  Directory.encodingLength = encodingLength
  Directory.encode = encode
  Directory.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (defined(obj.children)) {
      for (var i = 0; i < obj.children.length; i++) {
        if (!defined(obj.children[i])) continue
        var len = Link.encodingLength(obj.children[i])
        length += varint.encodingLength(len)
        length += 1 + len
      }
    }
    if (defined(obj.file)) {
      var len = File.encodingLength(obj.file)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (defined(obj.children)) {
      for (var i = 0; i < obj.children.length; i++) {
        if (!defined(obj.children[i])) continue
        buf[offset++] = 10
        varint.encode(Link.encodingLength(obj.children[i]), buf, offset)
        offset += varint.encode.bytes
        Link.encode(obj.children[i], buf, offset)
        offset += Link.encode.bytes
      }
    }
    if (defined(obj.file)) {
      buf[offset++] = 18
      varint.encode(File.encodingLength(obj.file), buf, offset)
      offset += varint.encode.bytes
      File.encode(obj.file, buf, offset)
      offset += File.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      children: [],
      file: null
    }
    while (true) {
      if (end <= offset) {
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.children.push(Link.decode(buf, offset, offset + len))
        offset += Link.decode.bytes
        break
        case 2:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.file = File.decode(buf, offset, offset + len)
        offset += File.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineFile () {
  File.encodingLength = encodingLength
  File.encode = encode
  File.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.id)) throw new Error("id is required")
    var len = encodings.string.encodingLength(obj.id)
    length += 1 + len
    if (!defined(obj.key)) throw new Error("key is required")
    var len = encodings.bytes.encodingLength(obj.key)
    length += 1 + len
    if (defined(obj.streamKey)) {
      var len = encodings.bytes.encodingLength(obj.streamKey)
      length += 1 + len
    }
    if (defined(obj.streamId)) {
      var len = encodings.bytes.encodingLength(obj.streamId)
      length += 1 + len
    }
    if (defined(obj.streamOffset)) {
      var len = encodings.varint.encodingLength(obj.streamOffset)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.id)) throw new Error("id is required")
    buf[offset++] = 10
    encodings.string.encode(obj.id, buf, offset)
    offset += encodings.string.encode.bytes
    if (!defined(obj.key)) throw new Error("key is required")
    buf[offset++] = 18
    encodings.bytes.encode(obj.key, buf, offset)
    offset += encodings.bytes.encode.bytes
    if (defined(obj.streamKey)) {
      buf[offset++] = 26
      encodings.bytes.encode(obj.streamKey, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.streamId)) {
      buf[offset++] = 34
      encodings.bytes.encode(obj.streamId, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    if (defined(obj.streamOffset)) {
      buf[offset++] = 40
      encodings.varint.encode(obj.streamOffset, buf, offset)
      offset += encodings.varint.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      id: "",
      key: null,
      streamKey: null,
      streamId: null,
      streamOffset: 0
    }
    var found0 = false
    var found1 = false
    while (true) {
      if (end <= offset) {
        if (!found0 || !found1) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.id = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.key = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        found1 = true
        break
        case 3:
        obj.streamKey = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 4:
        obj.streamId = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        case 5:
        obj.streamOffset = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineStream () {
  Stream.encodingLength = encodingLength
  Stream.encode = encode
  Stream.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.url)) throw new Error("url is required")
    var len = encodings.string.encodingLength(obj.url)
    length += 1 + len
    if (defined(obj.offset)) {
      var len = encodings.varint.encodingLength(obj.offset)
      length += 1 + len
    }
    if (defined(obj.streamKey)) {
      var len = encodings.bytes.encodingLength(obj.streamKey)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.url)) throw new Error("url is required")
    buf[offset++] = 10
    encodings.string.encode(obj.url, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.offset)) {
      buf[offset++] = 16
      encodings.varint.encode(obj.offset, buf, offset)
      offset += encodings.varint.encode.bytes
    }
    if (defined(obj.streamKey)) {
      buf[offset++] = 26
      encodings.bytes.encode(obj.streamKey, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      url: "",
      offset: 0,
      streamKey: null
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.url = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.offset = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        break
        case 3:
        obj.streamKey = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineShare () {
  Share.encodingLength = encodingLength
  Share.encode = encode
  Share.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (defined(obj.children)) {
      for (var i = 0; i < obj.children.length; i++) {
        if (!defined(obj.children[i])) continue
        var len = Link.encodingLength(obj.children[i])
        length += varint.encodingLength(len)
        length += 1 + len
      }
    }
    if (defined(obj.name)) {
      var len = encodings.string.encodingLength(obj.name)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (defined(obj.children)) {
      for (var i = 0; i < obj.children.length; i++) {
        if (!defined(obj.children[i])) continue
        buf[offset++] = 10
        varint.encode(Link.encodingLength(obj.children[i]), buf, offset)
        offset += varint.encode.bytes
        Link.encode(obj.children[i], buf, offset)
        offset += Link.encode.bytes
      }
    }
    if (defined(obj.name)) {
      buf[offset++] = 18
      encodings.string.encode(obj.name, buf, offset)
      offset += encodings.string.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      children: [],
      name: ""
    }
    while (true) {
      if (end <= offset) {
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.children.push(Link.decode(buf, offset, offset + len))
        offset += Link.decode.bytes
        break
        case 2:
        obj.name = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineNode () {
  Node.encodingLength = encodingLength
  Node.encode = encode
  Node.decode = decode

  function encodingLength (obj) {
    var length = 0
    if ((+defined(obj.dir) + +defined(obj.file) + +defined(obj.stream) + +defined(obj.share)) > 1) throw new Error("only one of the properties defined in oneof filetype can be set")
    if (!defined(obj.id)) throw new Error("id is required")
    var len = encodings.string.encodingLength(obj.id)
    length += 1 + len
    if (defined(obj.metadata)) {
      var tmp = Object.keys(obj.metadata)
      for (var i = 0; i < tmp.length; i++) {
        tmp[i] = {key: tmp[i], value: obj.metadata[tmp[i]]}
      }
      for (var i = 0; i < tmp.length; i++) {
        if (!defined(tmp[i])) continue
        var len = Map_string_bytes.encodingLength(tmp[i])
        length += varint.encodingLength(len)
        length += 1 + len
      }
    }
    if (defined(obj.dir)) {
      var len = Directory.encodingLength(obj.dir)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    if (defined(obj.file)) {
      var len = File.encodingLength(obj.file)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    if (defined(obj.stream)) {
      var len = Stream.encodingLength(obj.stream)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    if (defined(obj.share)) {
      var len = Share.encodingLength(obj.share)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if ((+defined(obj.dir) + +defined(obj.file) + +defined(obj.stream) + +defined(obj.share)) > 1) throw new Error("only one of the properties defined in oneof filetype can be set")
    if (!defined(obj.id)) throw new Error("id is required")
    buf[offset++] = 10
    encodings.string.encode(obj.id, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.metadata)) {
      var tmp = Object.keys(obj.metadata)
      for (var i = 0; i < tmp.length; i++) {
        tmp[i] = {key: tmp[i], value: obj.metadata[tmp[i]]}
      }
      for (var i = 0; i < tmp.length; i++) {
        if (!defined(tmp[i])) continue
        buf[offset++] = 18
        varint.encode(Map_string_bytes.encodingLength(tmp[i]), buf, offset)
        offset += varint.encode.bytes
        Map_string_bytes.encode(tmp[i], buf, offset)
        offset += Map_string_bytes.encode.bytes
      }
    }
    if (defined(obj.dir)) {
      buf[offset++] = 26
      varint.encode(Directory.encodingLength(obj.dir), buf, offset)
      offset += varint.encode.bytes
      Directory.encode(obj.dir, buf, offset)
      offset += Directory.encode.bytes
    }
    if (defined(obj.file)) {
      buf[offset++] = 34
      varint.encode(File.encodingLength(obj.file), buf, offset)
      offset += varint.encode.bytes
      File.encode(obj.file, buf, offset)
      offset += File.encode.bytes
    }
    if (defined(obj.stream)) {
      buf[offset++] = 42
      varint.encode(Stream.encodingLength(obj.stream), buf, offset)
      offset += varint.encode.bytes
      Stream.encode(obj.stream, buf, offset)
      offset += Stream.encode.bytes
    }
    if (defined(obj.share)) {
      buf[offset++] = 50
      varint.encode(Share.encodingLength(obj.share), buf, offset)
      offset += varint.encode.bytes
      Share.encode(obj.share, buf, offset)
      offset += Share.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      id: "",
      metadata: {},
      dir: null,
      file: null,
      stream: null,
      share: null
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.id = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        var tmp = Map_string_bytes.decode(buf, offset, offset + len)
        obj.metadata[tmp.key] = tmp.value
        offset += Map_string_bytes.decode.bytes
        break
        case 3:
        delete obj.file
        delete obj.stream
        delete obj.share
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.dir = Directory.decode(buf, offset, offset + len)
        offset += Directory.decode.bytes
        break
        case 4:
        delete obj.dir
        delete obj.stream
        delete obj.share
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.file = File.decode(buf, offset, offset + len)
        offset += File.decode.bytes
        break
        case 5:
        delete obj.dir
        delete obj.file
        delete obj.share
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.stream = Stream.decode(buf, offset, offset + len)
        offset += Stream.decode.bytes
        break
        case 6:
        delete obj.dir
        delete obj.file
        delete obj.stream
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.share = Share.decode(buf, offset, offset + len)
        offset += Share.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineMap_string_bytes () {
  Map_string_bytes.encodingLength = encodingLength
  Map_string_bytes.encode = encode
  Map_string_bytes.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.key)) throw new Error("key is required")
    var len = encodings.string.encodingLength(obj.key)
    length += 1 + len
    if (defined(obj.value)) {
      var len = encodings.bytes.encodingLength(obj.value)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.key)) throw new Error("key is required")
    buf[offset++] = 10
    encodings.string.encode(obj.key, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.value)) {
      buf[offset++] = 18
      encodings.bytes.encode(obj.value, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      key: "",
      value: null
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.key = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.value = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defined (val) {
  return val !== null && val !== undefined && (typeof val !== 'number' || !isNaN(val))
}
