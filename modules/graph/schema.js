/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const Link = $root.Link = (() => {

    /**
     * Properties of a Link.
     * @exports ILink
     * @interface ILink
     * @property {string} id Link id
     * @property {Uint8Array} key Link key
     * @property {string|null} [name] Link name
     * @property {string|null} [url] Link url
     * @property {Array.<string>|null} [owners] Link owners
     */

    /**
     * Constructs a new Link.
     * @exports Link
     * @classdesc Represents a Link.
     * @implements ILink
     * @constructor
     * @param {ILink=} [properties] Properties to set
     */
    function Link(properties) {
        this.owners = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Link id.
     * @member {string} id
     * @memberof Link
     * @instance
     */
    Link.prototype.id = "";

    /**
     * Link key.
     * @member {Uint8Array} key
     * @memberof Link
     * @instance
     */
    Link.prototype.key = $util.newBuffer([]);

    /**
     * Link name.
     * @member {string} name
     * @memberof Link
     * @instance
     */
    Link.prototype.name = "";

    /**
     * Link url.
     * @member {string} url
     * @memberof Link
     * @instance
     */
    Link.prototype.url = "";

    /**
     * Link owners.
     * @member {Array.<string>} owners
     * @memberof Link
     * @instance
     */
    Link.prototype.owners = $util.emptyArray;

    /**
     * Creates a new Link instance using the specified properties.
     * @function create
     * @memberof Link
     * @static
     * @param {ILink=} [properties] Properties to set
     * @returns {Link} Link instance
     */
    Link.create = function create(properties) {
        return new Link(properties);
    };

    /**
     * Encodes the specified Link message. Does not implicitly {@link Link.verify|verify} messages.
     * @function encode
     * @memberof Link
     * @static
     * @param {ILink} message Link message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Link.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
        writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.key);
        if (message.name != null && Object.hasOwnProperty.call(message, "name"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.name);
        if (message.url != null && Object.hasOwnProperty.call(message, "url"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.url);
        if (message.owners != null && message.owners.length)
            for (let i = 0; i < message.owners.length; ++i)
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.owners[i]);
        return writer;
    };

    /**
     * Encodes the specified Link message, length delimited. Does not implicitly {@link Link.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Link
     * @static
     * @param {ILink} message Link message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Link.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Link message from the specified reader or buffer.
     * @function decode
     * @memberof Link
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Link} Link
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Link.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Link();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.id = reader.string();
                break;
            case 2:
                message.key = reader.bytes();
                break;
            case 3:
                message.name = reader.string();
                break;
            case 4:
                message.url = reader.string();
                break;
            case 5:
                if (!(message.owners && message.owners.length))
                    message.owners = [];
                message.owners.push(reader.string());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("id"))
            throw $util.ProtocolError("missing required 'id'", { instance: message });
        if (!message.hasOwnProperty("key"))
            throw $util.ProtocolError("missing required 'key'", { instance: message });
        return message;
    };

    /**
     * Decodes a Link message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Link
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Link} Link
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Link.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Link message.
     * @function verify
     * @memberof Link
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Link.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isString(message.id))
            return "id: string expected";
        if (!(message.key && typeof message.key.length === "number" || $util.isString(message.key)))
            return "key: buffer expected";
        if (message.name != null && message.hasOwnProperty("name"))
            if (!$util.isString(message.name))
                return "name: string expected";
        if (message.url != null && message.hasOwnProperty("url"))
            if (!$util.isString(message.url))
                return "url: string expected";
        if (message.owners != null && message.hasOwnProperty("owners")) {
            if (!Array.isArray(message.owners))
                return "owners: array expected";
            for (let i = 0; i < message.owners.length; ++i)
                if (!$util.isString(message.owners[i]))
                    return "owners: string[] expected";
        }
        return null;
    };

    /**
     * Creates a Link message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Link
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Link} Link
     */
    Link.fromObject = function fromObject(object) {
        if (object instanceof $root.Link)
            return object;
        let message = new $root.Link();
        if (object.id != null)
            message.id = String(object.id);
        if (object.key != null)
            if (typeof object.key === "string")
                $util.base64.decode(object.key, message.key = $util.newBuffer($util.base64.length(object.key)), 0);
            else if (object.key.length)
                message.key = object.key;
        if (object.name != null)
            message.name = String(object.name);
        if (object.url != null)
            message.url = String(object.url);
        if (object.owners) {
            if (!Array.isArray(object.owners))
                throw TypeError(".Link.owners: array expected");
            message.owners = [];
            for (let i = 0; i < object.owners.length; ++i)
                message.owners[i] = String(object.owners[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from a Link message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Link
     * @static
     * @param {Link} message Link
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Link.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.owners = [];
        if (options.defaults) {
            object.id = "";
            if (options.bytes === String)
                object.key = "";
            else {
                object.key = [];
                if (options.bytes !== Array)
                    object.key = $util.newBuffer(object.key);
            }
            object.name = "";
            object.url = "";
        }
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        if (message.key != null && message.hasOwnProperty("key"))
            object.key = options.bytes === String ? $util.base64.encode(message.key, 0, message.key.length) : options.bytes === Array ? Array.prototype.slice.call(message.key) : message.key;
        if (message.name != null && message.hasOwnProperty("name"))
            object.name = message.name;
        if (message.url != null && message.hasOwnProperty("url"))
            object.url = message.url;
        if (message.owners && message.owners.length) {
            object.owners = [];
            for (let j = 0; j < message.owners.length; ++j)
                object.owners[j] = message.owners[j];
        }
        return object;
    };

    /**
     * Converts this Link to JSON.
     * @function toJSON
     * @memberof Link
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Link.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Link;
})();

export const Directory = $root.Directory = (() => {

    /**
     * Properties of a Directory.
     * @exports IDirectory
     * @interface IDirectory
     * @property {Array.<ILink>|null} [children] Directory children
     */

    /**
     * Constructs a new Directory.
     * @exports Directory
     * @classdesc Represents a Directory.
     * @implements IDirectory
     * @constructor
     * @param {IDirectory=} [properties] Properties to set
     */
    function Directory(properties) {
        this.children = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Directory children.
     * @member {Array.<ILink>} children
     * @memberof Directory
     * @instance
     */
    Directory.prototype.children = $util.emptyArray;

    /**
     * Creates a new Directory instance using the specified properties.
     * @function create
     * @memberof Directory
     * @static
     * @param {IDirectory=} [properties] Properties to set
     * @returns {Directory} Directory instance
     */
    Directory.create = function create(properties) {
        return new Directory(properties);
    };

    /**
     * Encodes the specified Directory message. Does not implicitly {@link Directory.verify|verify} messages.
     * @function encode
     * @memberof Directory
     * @static
     * @param {IDirectory} message Directory message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Directory.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.children != null && message.children.length)
            for (let i = 0; i < message.children.length; ++i)
                $root.Link.encode(message.children[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Directory message, length delimited. Does not implicitly {@link Directory.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Directory
     * @static
     * @param {IDirectory} message Directory message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Directory.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Directory message from the specified reader or buffer.
     * @function decode
     * @memberof Directory
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Directory} Directory
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Directory.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Directory();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.children && message.children.length))
                    message.children = [];
                message.children.push($root.Link.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Directory message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Directory
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Directory} Directory
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Directory.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Directory message.
     * @function verify
     * @memberof Directory
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Directory.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.children != null && message.hasOwnProperty("children")) {
            if (!Array.isArray(message.children))
                return "children: array expected";
            for (let i = 0; i < message.children.length; ++i) {
                let error = $root.Link.verify(message.children[i]);
                if (error)
                    return "children." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Directory message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Directory
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Directory} Directory
     */
    Directory.fromObject = function fromObject(object) {
        if (object instanceof $root.Directory)
            return object;
        let message = new $root.Directory();
        if (object.children) {
            if (!Array.isArray(object.children))
                throw TypeError(".Directory.children: array expected");
            message.children = [];
            for (let i = 0; i < object.children.length; ++i) {
                if (typeof object.children[i] !== "object")
                    throw TypeError(".Directory.children: object expected");
                message.children[i] = $root.Link.fromObject(object.children[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a Directory message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Directory
     * @static
     * @param {Directory} message Directory
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Directory.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.children = [];
        if (message.children && message.children.length) {
            object.children = [];
            for (let j = 0; j < message.children.length; ++j)
                object.children[j] = $root.Link.toObject(message.children[j], options);
        }
        return object;
    };

    /**
     * Converts this Directory to JSON.
     * @function toJSON
     * @memberof Directory
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Directory.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Directory;
})();

export const File = $root.File = (() => {

    /**
     * Properties of a File.
     * @exports IFile
     * @interface IFile
     * @property {string} fileId File fileId
     */

    /**
     * Constructs a new File.
     * @exports File
     * @classdesc Represents a File.
     * @implements IFile
     * @constructor
     * @param {IFile=} [properties] Properties to set
     */
    function File(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * File fileId.
     * @member {string} fileId
     * @memberof File
     * @instance
     */
    File.prototype.fileId = "";

    /**
     * Creates a new File instance using the specified properties.
     * @function create
     * @memberof File
     * @static
     * @param {IFile=} [properties] Properties to set
     * @returns {File} File instance
     */
    File.create = function create(properties) {
        return new File(properties);
    };

    /**
     * Encodes the specified File message. Does not implicitly {@link File.verify|verify} messages.
     * @function encode
     * @memberof File
     * @static
     * @param {IFile} message File message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    File.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 2 =*/10).string(message.fileId);
        return writer;
    };

    /**
     * Encodes the specified File message, length delimited. Does not implicitly {@link File.verify|verify} messages.
     * @function encodeDelimited
     * @memberof File
     * @static
     * @param {IFile} message File message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    File.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a File message from the specified reader or buffer.
     * @function decode
     * @memberof File
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {File} File
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    File.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.File();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.fileId = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("fileId"))
            throw $util.ProtocolError("missing required 'fileId'", { instance: message });
        return message;
    };

    /**
     * Decodes a File message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof File
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {File} File
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    File.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a File message.
     * @function verify
     * @memberof File
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    File.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isString(message.fileId))
            return "fileId: string expected";
        return null;
    };

    /**
     * Creates a File message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof File
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {File} File
     */
    File.fromObject = function fromObject(object) {
        if (object instanceof $root.File)
            return object;
        let message = new $root.File();
        if (object.fileId != null)
            message.fileId = String(object.fileId);
        return message;
    };

    /**
     * Creates a plain object from a File message. Also converts values to other types if specified.
     * @function toObject
     * @memberof File
     * @static
     * @param {File} message File
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    File.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.fileId = "";
        if (message.fileId != null && message.hasOwnProperty("fileId"))
            object.fileId = message.fileId;
        return object;
    };

    /**
     * Converts this File to JSON.
     * @function toJSON
     * @memberof File
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    File.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return File;
})();

export const Stream = $root.Stream = (() => {

    /**
     * Properties of a Stream.
     * @exports IStream
     * @interface IStream
     * @property {string} url Stream url
     * @property {number|Long|null} [offset] Stream offset
     */

    /**
     * Constructs a new Stream.
     * @exports Stream
     * @classdesc Represents a Stream.
     * @implements IStream
     * @constructor
     * @param {IStream=} [properties] Properties to set
     */
    function Stream(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Stream url.
     * @member {string} url
     * @memberof Stream
     * @instance
     */
    Stream.prototype.url = "";

    /**
     * Stream offset.
     * @member {number|Long} offset
     * @memberof Stream
     * @instance
     */
    Stream.prototype.offset = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

    /**
     * Creates a new Stream instance using the specified properties.
     * @function create
     * @memberof Stream
     * @static
     * @param {IStream=} [properties] Properties to set
     * @returns {Stream} Stream instance
     */
    Stream.create = function create(properties) {
        return new Stream(properties);
    };

    /**
     * Encodes the specified Stream message. Does not implicitly {@link Stream.verify|verify} messages.
     * @function encode
     * @memberof Stream
     * @static
     * @param {IStream} message Stream message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Stream.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 2 =*/10).string(message.url);
        if (message.offset != null && Object.hasOwnProperty.call(message, "offset"))
            writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.offset);
        return writer;
    };

    /**
     * Encodes the specified Stream message, length delimited. Does not implicitly {@link Stream.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Stream
     * @static
     * @param {IStream} message Stream message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Stream.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Stream message from the specified reader or buffer.
     * @function decode
     * @memberof Stream
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Stream} Stream
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Stream.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Stream();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.url = reader.string();
                break;
            case 2:
                message.offset = reader.uint64();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("url"))
            throw $util.ProtocolError("missing required 'url'", { instance: message });
        return message;
    };

    /**
     * Decodes a Stream message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Stream
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Stream} Stream
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Stream.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Stream message.
     * @function verify
     * @memberof Stream
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Stream.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isString(message.url))
            return "url: string expected";
        if (message.offset != null && message.hasOwnProperty("offset"))
            if (!$util.isInteger(message.offset) && !(message.offset && $util.isInteger(message.offset.low) && $util.isInteger(message.offset.high)))
                return "offset: integer|Long expected";
        return null;
    };

    /**
     * Creates a Stream message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Stream
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Stream} Stream
     */
    Stream.fromObject = function fromObject(object) {
        if (object instanceof $root.Stream)
            return object;
        let message = new $root.Stream();
        if (object.url != null)
            message.url = String(object.url);
        if (object.offset != null)
            if ($util.Long)
                (message.offset = $util.Long.fromValue(object.offset)).unsigned = true;
            else if (typeof object.offset === "string")
                message.offset = parseInt(object.offset, 10);
            else if (typeof object.offset === "number")
                message.offset = object.offset;
            else if (typeof object.offset === "object")
                message.offset = new $util.LongBits(object.offset.low >>> 0, object.offset.high >>> 0).toNumber(true);
        return message;
    };

    /**
     * Creates a plain object from a Stream message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Stream
     * @static
     * @param {Stream} message Stream
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Stream.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.url = "";
            if ($util.Long) {
                let long = new $util.Long(0, 0, true);
                object.offset = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
            } else
                object.offset = options.longs === String ? "0" : 0;
        }
        if (message.url != null && message.hasOwnProperty("url"))
            object.url = message.url;
        if (message.offset != null && message.hasOwnProperty("offset"))
            if (typeof message.offset === "number")
                object.offset = options.longs === String ? String(message.offset) : message.offset;
            else
                object.offset = options.longs === String ? $util.Long.prototype.toString.call(message.offset) : options.longs === Number ? new $util.LongBits(message.offset.low >>> 0, message.offset.high >>> 0).toNumber(true) : message.offset;
        return object;
    };

    /**
     * Converts this Stream to JSON.
     * @function toJSON
     * @memberof Stream
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Stream.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Stream;
})();

export const Share = $root.Share = (() => {

    /**
     * Properties of a Share.
     * @exports IShare
     * @interface IShare
     * @property {Array.<ILink>|null} [children] Share children
     */

    /**
     * Constructs a new Share.
     * @exports Share
     * @classdesc Represents a Share.
     * @implements IShare
     * @constructor
     * @param {IShare=} [properties] Properties to set
     */
    function Share(properties) {
        this.children = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Share children.
     * @member {Array.<ILink>} children
     * @memberof Share
     * @instance
     */
    Share.prototype.children = $util.emptyArray;

    /**
     * Creates a new Share instance using the specified properties.
     * @function create
     * @memberof Share
     * @static
     * @param {IShare=} [properties] Properties to set
     * @returns {Share} Share instance
     */
    Share.create = function create(properties) {
        return new Share(properties);
    };

    /**
     * Encodes the specified Share message. Does not implicitly {@link Share.verify|verify} messages.
     * @function encode
     * @memberof Share
     * @static
     * @param {IShare} message Share message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Share.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.children != null && message.children.length)
            for (let i = 0; i < message.children.length; ++i)
                $root.Link.encode(message.children[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Share message, length delimited. Does not implicitly {@link Share.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Share
     * @static
     * @param {IShare} message Share message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Share.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Share message from the specified reader or buffer.
     * @function decode
     * @memberof Share
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Share} Share
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Share.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Share();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.children && message.children.length))
                    message.children = [];
                message.children.push($root.Link.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Share message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Share
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Share} Share
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Share.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Share message.
     * @function verify
     * @memberof Share
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Share.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.children != null && message.hasOwnProperty("children")) {
            if (!Array.isArray(message.children))
                return "children: array expected";
            for (let i = 0; i < message.children.length; ++i) {
                let error = $root.Link.verify(message.children[i]);
                if (error)
                    return "children." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Share message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Share
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Share} Share
     */
    Share.fromObject = function fromObject(object) {
        if (object instanceof $root.Share)
            return object;
        let message = new $root.Share();
        if (object.children) {
            if (!Array.isArray(object.children))
                throw TypeError(".Share.children: array expected");
            message.children = [];
            for (let i = 0; i < object.children.length; ++i) {
                if (typeof object.children[i] !== "object")
                    throw TypeError(".Share.children: object expected");
                message.children[i] = $root.Link.fromObject(object.children[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a Share message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Share
     * @static
     * @param {Share} message Share
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Share.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.children = [];
        if (message.children && message.children.length) {
            object.children = [];
            for (let j = 0; j < message.children.length; ++j)
                object.children[j] = $root.Link.toObject(message.children[j], options);
        }
        return object;
    };

    /**
     * Converts this Share to JSON.
     * @function toJSON
     * @memberof Share
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Share.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Share;
})();

export const Node = $root.Node = (() => {

    /**
     * Properties of a Node.
     * @exports INode
     * @interface INode
     * @property {string} id Node id
     * @property {Object.<string,Uint8Array>|null} [metadata] Node metadata
     * @property {IDirectory|null} [dir] Node dir
     * @property {IFile|null} [file] Node file
     * @property {IStream|null} [stream] Node stream
     * @property {IShare|null} [share] Node share
     */

    /**
     * Constructs a new Node.
     * @exports Node
     * @classdesc Represents a Node.
     * @implements INode
     * @constructor
     * @param {INode=} [properties] Properties to set
     */
    function Node(properties) {
        this.metadata = {};
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Node id.
     * @member {string} id
     * @memberof Node
     * @instance
     */
    Node.prototype.id = "";

    /**
     * Node metadata.
     * @member {Object.<string,Uint8Array>} metadata
     * @memberof Node
     * @instance
     */
    Node.prototype.metadata = $util.emptyObject;

    /**
     * Node dir.
     * @member {IDirectory|null|undefined} dir
     * @memberof Node
     * @instance
     */
    Node.prototype.dir = null;

    /**
     * Node file.
     * @member {IFile|null|undefined} file
     * @memberof Node
     * @instance
     */
    Node.prototype.file = null;

    /**
     * Node stream.
     * @member {IStream|null|undefined} stream
     * @memberof Node
     * @instance
     */
    Node.prototype.stream = null;

    /**
     * Node share.
     * @member {IShare|null|undefined} share
     * @memberof Node
     * @instance
     */
    Node.prototype.share = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * Node filetype.
     * @member {"dir"|"file"|"stream"|"share"|undefined} filetype
     * @memberof Node
     * @instance
     */
    Object.defineProperty(Node.prototype, "filetype", {
        get: $util.oneOfGetter($oneOfFields = ["dir", "file", "stream", "share"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Node instance using the specified properties.
     * @function create
     * @memberof Node
     * @static
     * @param {INode=} [properties] Properties to set
     * @returns {Node} Node instance
     */
    Node.create = function create(properties) {
        return new Node(properties);
    };

    /**
     * Encodes the specified Node message. Does not implicitly {@link Node.verify|verify} messages.
     * @function encode
     * @memberof Node
     * @static
     * @param {INode} message Node message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Node.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
        if (message.metadata != null && Object.hasOwnProperty.call(message, "metadata"))
            for (let keys = Object.keys(message.metadata), i = 0; i < keys.length; ++i)
                writer.uint32(/* id 2, wireType 2 =*/18).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).bytes(message.metadata[keys[i]]).ldelim();
        if (message.dir != null && Object.hasOwnProperty.call(message, "dir"))
            $root.Directory.encode(message.dir, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.file != null && Object.hasOwnProperty.call(message, "file"))
            $root.File.encode(message.file, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.stream != null && Object.hasOwnProperty.call(message, "stream"))
            $root.Stream.encode(message.stream, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.share != null && Object.hasOwnProperty.call(message, "share"))
            $root.Share.encode(message.share, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Node message, length delimited. Does not implicitly {@link Node.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Node
     * @static
     * @param {INode} message Node message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Node.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Node message from the specified reader or buffer.
     * @function decode
     * @memberof Node
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Node} Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Node.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Node(), key, value;
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.id = reader.string();
                break;
            case 2:
                if (message.metadata === $util.emptyObject)
                    message.metadata = {};
                let end2 = reader.uint32() + reader.pos;
                key = "";
                value = [];
                while (reader.pos < end2) {
                    let tag2 = reader.uint32();
                    switch (tag2 >>> 3) {
                    case 1:
                        key = reader.string();
                        break;
                    case 2:
                        value = reader.bytes();
                        break;
                    default:
                        reader.skipType(tag2 & 7);
                        break;
                    }
                }
                message.metadata[key] = value;
                break;
            case 3:
                message.dir = $root.Directory.decode(reader, reader.uint32());
                break;
            case 4:
                message.file = $root.File.decode(reader, reader.uint32());
                break;
            case 5:
                message.stream = $root.Stream.decode(reader, reader.uint32());
                break;
            case 6:
                message.share = $root.Share.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("id"))
            throw $util.ProtocolError("missing required 'id'", { instance: message });
        return message;
    };

    /**
     * Decodes a Node message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Node
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Node} Node
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Node.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Node message.
     * @function verify
     * @memberof Node
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Node.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (!$util.isString(message.id))
            return "id: string expected";
        if (message.metadata != null && message.hasOwnProperty("metadata")) {
            if (!$util.isObject(message.metadata))
                return "metadata: object expected";
            let key = Object.keys(message.metadata);
            for (let i = 0; i < key.length; ++i)
                if (!(message.metadata[key[i]] && typeof message.metadata[key[i]].length === "number" || $util.isString(message.metadata[key[i]])))
                    return "metadata: buffer{k:string} expected";
        }
        if (message.dir != null && message.hasOwnProperty("dir")) {
            properties.filetype = 1;
            {
                let error = $root.Directory.verify(message.dir);
                if (error)
                    return "dir." + error;
            }
        }
        if (message.file != null && message.hasOwnProperty("file")) {
            if (properties.filetype === 1)
                return "filetype: multiple values";
            properties.filetype = 1;
            {
                let error = $root.File.verify(message.file);
                if (error)
                    return "file." + error;
            }
        }
        if (message.stream != null && message.hasOwnProperty("stream")) {
            if (properties.filetype === 1)
                return "filetype: multiple values";
            properties.filetype = 1;
            {
                let error = $root.Stream.verify(message.stream);
                if (error)
                    return "stream." + error;
            }
        }
        if (message.share != null && message.hasOwnProperty("share")) {
            if (properties.filetype === 1)
                return "filetype: multiple values";
            properties.filetype = 1;
            {
                let error = $root.Share.verify(message.share);
                if (error)
                    return "share." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Node message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Node
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Node} Node
     */
    Node.fromObject = function fromObject(object) {
        if (object instanceof $root.Node)
            return object;
        let message = new $root.Node();
        if (object.id != null)
            message.id = String(object.id);
        if (object.metadata) {
            if (typeof object.metadata !== "object")
                throw TypeError(".Node.metadata: object expected");
            message.metadata = {};
            for (let keys = Object.keys(object.metadata), i = 0; i < keys.length; ++i)
                if (typeof object.metadata[keys[i]] === "string")
                    $util.base64.decode(object.metadata[keys[i]], message.metadata[keys[i]] = $util.newBuffer($util.base64.length(object.metadata[keys[i]])), 0);
                else if (object.metadata[keys[i]].length)
                    message.metadata[keys[i]] = object.metadata[keys[i]];
        }
        if (object.dir != null) {
            if (typeof object.dir !== "object")
                throw TypeError(".Node.dir: object expected");
            message.dir = $root.Directory.fromObject(object.dir);
        }
        if (object.file != null) {
            if (typeof object.file !== "object")
                throw TypeError(".Node.file: object expected");
            message.file = $root.File.fromObject(object.file);
        }
        if (object.stream != null) {
            if (typeof object.stream !== "object")
                throw TypeError(".Node.stream: object expected");
            message.stream = $root.Stream.fromObject(object.stream);
        }
        if (object.share != null) {
            if (typeof object.share !== "object")
                throw TypeError(".Node.share: object expected");
            message.share = $root.Share.fromObject(object.share);
        }
        return message;
    };

    /**
     * Creates a plain object from a Node message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Node
     * @static
     * @param {Node} message Node
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Node.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.objects || options.defaults)
            object.metadata = {};
        if (options.defaults)
            object.id = "";
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        let keys2;
        if (message.metadata && (keys2 = Object.keys(message.metadata)).length) {
            object.metadata = {};
            for (let j = 0; j < keys2.length; ++j)
                object.metadata[keys2[j]] = options.bytes === String ? $util.base64.encode(message.metadata[keys2[j]], 0, message.metadata[keys2[j]].length) : options.bytes === Array ? Array.prototype.slice.call(message.metadata[keys2[j]]) : message.metadata[keys2[j]];
        }
        if (message.dir != null && message.hasOwnProperty("dir")) {
            object.dir = $root.Directory.toObject(message.dir, options);
            if (options.oneofs)
                object.filetype = "dir";
        }
        if (message.file != null && message.hasOwnProperty("file")) {
            object.file = $root.File.toObject(message.file, options);
            if (options.oneofs)
                object.filetype = "file";
        }
        if (message.stream != null && message.hasOwnProperty("stream")) {
            object.stream = $root.Stream.toObject(message.stream, options);
            if (options.oneofs)
                object.filetype = "stream";
        }
        if (message.share != null && message.hasOwnProperty("share")) {
            object.share = $root.Share.toObject(message.share, options);
            if (options.oneofs)
                object.filetype = "share";
        }
        return object;
    };

    /**
     * Converts this Node to JSON.
     * @function toJSON
     * @memberof Node
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Node.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Node;
})();

module.exports = $root;
