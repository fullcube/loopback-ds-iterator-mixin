'use strict';

const debug = require('debug')('loopback-ds-iterator-mixin');
const utils = require('loopback-datasource-juggler/lib/utils');
const assert = require('assert');
const deprecate = require('util').deprecate;
const iterators = require('async-iterators');
const async = require('async');
const _ = require('lodash');

class IteratorCls {
  constructor(Model, query, options) {
    const self = this;
    self.Model = Model;
    self.query = query || {};
    options = options || {};
    _.assign(self, _.defaults(options, {
      debugPrefix: '',
      batchSize: 100,
      maxQueueLength: 50,
      queueWaitInterval: 100,
      concurrentItems: 50
    }));
    self.itemsFrom = self.query.skip || 0;
    self.itemsTo = self.itemsFrom;
    self.limit = self.query.limit;
    self.initialized = false;
    self.itemsTotal;
    self.pageTotal;
    self.currentItem = 0;
    self.currentItems = [];
    self.queue = undefined;
  }

  initialize(cb = utils.createPromiseCallback()) {
    const self = this;

    if (self.initialized) {
      process.nextTick(() => {
        cb();
      });
      return cb.promise;
    }

    debug(self.debugPrefix, 'Initializing');
    const countWhere = self.query.where || {};
    self.Model.count(countWhere).then(count => {
      self.itemsTotal = self.limit ? Math.min(count, self.limit) : count;
      self.pageTotal = Math.ceil(self.itemsTotal / self.batchSize);
      self.initialized = true;
      cb();
    }).catch(cb);

    return cb.promise;
  }

  next(cb = utils.createPromiseCallback()) {
    const self = this;
    // If we are already at the end, return nothing,
    if (self.initialized && self.currentItem >= self.itemsTotal) {
      process.nextTick(() => {
        cb(null);
      });
      return cb.promise;
    }
    // Otherwise, return the next result.
    self._getNextValue().then(value => {
      cb(null, value);
    }).catch(cb);
    return cb.promise;
  }

  _getNextValue(cb = utils.createPromiseCallback()) {
    const self = this;

    // If we already have some results, return the next one.
    if (self.currentItems.length) {
      process.nextTick(() => {
        self.currentItem++;
        cb(null, self.currentItems.shift());
      });
      return cb.promise;
    }

    // Fetch the next page of results if there are some.
    debug(`${ self.debugPrefix }Fetching next batch. Current item: %s : Memory usage: %s`,
        self.currentItem, (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'Mb');

    self.initialize().then(() => {
      self.query.skip = self.itemsTo;
      self.query.limit = self.batchSize;
      return self.Model.find(_.clone(self.query));
    }).then(data => {
      // Update the pager.
      self.itemsFrom = self.query.skip;
      self.itemsTo = self.query.skip + data.length;
      // Store the current item set.
      self.currentItems = data;
      // Return the next item.
      self.currentItem++;
      cb(null, self.currentItems.shift());
    }).catch(cb);

    return cb.promise;
  }

  forEachAsync(fn, cb = utils.createPromiseCallback()) {
    const self = this;

    debug(`${ self.debugPrefix }Total items to process: %s`, self.itemsTotal);

    // Create a queue that will process upto concurrentItems concurrent items using fn.
    self.queue = async.queue(fn, self.concurrentItems);

    // Iterate over the records.
    iterators.forEachAsync(self, (err, item, cb) => {
      // Queue each item for processing.
      self.queue.push({
        item: item,
        iterator: self
      });
      // Prevent the queue from adding more items that it can process concurrently.
      async.whilst(() => {
        return self.queue.length() > self.maxQueueLength;
      }, callback => {
        setTimeout(callback, self.queueWaitInterval);
      }, err => {
        process.nextTick(() => {
          cb();
        });
      });
    }, () => {
      // The last item from the iterator has been processed.
      // Wait for the queue finish processong items before moving on.
      async.whilst(self.queue.running, callback => {
        setTimeout(callback, self.queueWaitInterval);
      }, cb);
    });

    return cb.promise;
  }
}
