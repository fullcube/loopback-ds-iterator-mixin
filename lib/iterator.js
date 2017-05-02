'use strict'

const debug = require('debug')('loopback:mixin:iterator')
const utils = require('loopback-datasource-juggler/lib/utils')
const _ = require('lodash')
const LoopbackIterator = require('./loopback-iterator')

module.exports = (Model, config = {}) => {
  debug('Loading with config %o', config)

  /**
   * An iterator that will lazy load items from the Datastore.
   */
  Model.iterate = (query, options) => new LoopbackIterator(Model, query, _.defaults(options, config))

  /**
   * An iterator that will lazy load items from the Datastore.
   */
  Model.forEachAsync = (query, fn, options, cb = utils.createPromiseCallback()) => {
    const iterator = Model.iterate(query, options)

    iterator.forEachAsync(fn, cb)
    return cb.promise
  }
}
