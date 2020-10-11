module.exports = class KeyCache {
  constructor () {
    /** @type {Map<string, Map<string, any> | RangeEntries>} */
    this.feeds = new Map()
  }

  set (feed, id, value) {
    let entries = this.feeds.get(feed)
    if (!entries) {
      if (typeof id === 'string') entries = new Map()
      else if (typeof id === 'number') entries = new RangeEntries()
      else throw new Error('id has to be either a string or a number')
      this.feeds.set(feed, entries)
    }
    entries.set(id, value)
  }

  get (feed, id) {
    const entries = this.feeds.get(feed)
    if (!entries) return null
    return entries.get(id)
  }
}

class RangeEntries {
  constructor () {
    this.entries = []
  }

  set (index, value) {
    if (this.entries.length === 0) return this.entries.push({ index, value })

    let i = this.entries.length - 1
    while (i > 0 && this.entries[i].index > index) i--

    if (i === this.entries.length - 1) this.entries.push({ index, value })
    else this.entries.splice(i, 0, { index, value })
  }

  get (searched) {
    if (this.entries.length === 0) return null

    let zerodiff = this.entries[0].index - searched
    // first element is larger -> no element that is <= value
    if (zerodiff > 0) return null
    // often this is the case, so check this before starting the binary search
    if (zerodiff === 0) return this.entries[0].value

    // also often the case: last element
    zerodiff = this.entries[this.entries.length - 1].index - searched
    if (zerodiff <= 0) return this.entries[this.entries.length - 1].value

    let left = 0
    let right = this.entries.length - 1
    let mid = Math.floor((right - left) / 2)

    // binary search
    while (right - left > 1) {
      const midelem = this.entries[mid].index
      const diff = midelem - searched
      if (diff < 0) {
        left = mid
        mid = Math.floor((right - left) / 2) + mid
      } else {
        if (diff === 0) {
          return midelem
        }
        right = mid
        mid = Math.floor((right - left) / 2)
      }
    }

    return this.entries[left].value
  }
}
