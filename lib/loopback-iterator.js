'use strict'

const debug = require('debug')('loopback:mixin:iterator')
const utils = require('loopback-datasource-juggler/lib/utils')
const iterators = require('async-iterators')
const async = require('async')
const _ = require('lodash')

module.exports = class LoopbackIterator {
  constructor(Model, query, options = {}) {
    this.Model = Model
    this.query = query || {}

    _.assign(this, _.defaults(options, {
      batchSize: 100,
      maxQueueLength: 50,
      queueWaitInterval: 100,
      concurrentItems: 50,
    }))

    this.itemsFrom = this.query.skip || 0
    this.itemsTo = this.itemsFrom
    this.limit = this.query.limit

    this.initialized = false
    this.itemsTotal = null
    this.pageTotal = null
    this.currentItem = 0
    this.currentItems = []

    this.queue = null
  }

  initialize(cb = utils.createPromiseCallback()) {
    if (this.initialized) {
      process.nextTick(() => cb())
      return cb.promise
    }

    debug('Initializing')

    const countWhere = this.query.where || {}

    this.Model.count(countWhere)
      .then(count => {
        this.itemsTotal = this.limit ? Math.min(count, this.limit) : count
        this.pageTotal = Math.ceil(this.itemsTotal / this.batchSize)
        this.initialized = true
        return cb()
      })
    .catch(cb)

    return cb.promise
  }

  next(cb = utils.createPromiseCallback()) {
    // If we are already at the end, return nothing,
    if (this.initialized && this.currentItem >= this.itemsTotal) {
      process.nextTick(() => cb())
      return cb.promise
    }

    // Otherwise, return the next result.
    this._getNextValue()
      .then(value => cb(null, value))
      .catch(cb)

    return cb.promise
  }

  _getNextValue(cb = utils.createPromiseCallback()) {
    // If we already have some results, return the next one.
    if (this.currentItems.length) {
      process.nextTick(() => {
        this.currentItem++
        cb(null, this.currentItems.shift())
      })
      return cb.promise
    }

    // Fetch the next page of results if there are some.
    debug('Fetching next batch. Current item: %s : Memory usage: %s',
      this.currentItem, (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'Mb')

    this.initialize()
      .then(() => {
        this.query.skip = this.itemsTo
        this.query.limit = this.batchSize
        return this.Model.find(_.clone(this.query))
      })
      .then(data => {
        // Update the pager.
        this.itemsFrom = this.query.skip
        this.itemsTo = this.query.skip + data.length

        // Store the current item set.
        this.currentItems = data

        // Return the next item.
        this.currentItem++
        cb(null, this.currentItems.shift())
      })
      .catch(cb)

    return cb.promise
  }

  forEachAsync(fn, cb = utils.createPromiseCallback()) {
    debug('Total items to process: %s', this.itemsTotal)

    // Create a queue that will process upto concurrentItems concurrent items using fn.
    this.queue = async.queue(fn, this.concurrentItems)

    // Iterate over the records.
    iterators.forEachAsync(this, (err, item, next) => {
      if (err) {
        this.err = err
        this.queue.kill()
      }

      if (!this.err) {
        // Queue each item for processing.
        this.queue.push({
          item,
          status: {
            itemsFrom: this.itemsFrom,
            itemsTo: this.itemsTo,
            itemsTotal: this.itemsTotal,
            pageTotal: this.pageTotal,
            currentItem: this.currentItem,
          },
        }, err => {
          if (err) {
            this.err = err
            this.queue.kill()
          }
        })
      }

      // Prevent the queue from adding more items that it can process concurrently.
      async.whilst(
        () => (!this.queue.idle() && this.queue.length() > this.maxQueueLength),
        callback => setTimeout(callback, this.queueWaitInterval),
        () => {
          process.nextTick(() => {
            if (this.err) {
              return cb(this.err)
            }
            return next()
          })
        }
      )
    }, () => {
      // The last item from the iterator has been processed.
      // Wait for the queue finish processong items before moving on.
      async.whilst(
        this.queue.running,
        callback => setTimeout(callback, this.queueWaitInterval),
        () => cb()
      )
    })

    return cb.promise
  }
}
