const debug = require('debug')('loopback-ds-iterator-mixin');
const utils = require('loopback-datasource-juggler/lib/utils');
const iterators = require('async-iterators');
const async = require('async');
const _ = require('lodash');

export default class IteratorCls {
  constructor(Model, query, options) {
    this.Model = Model;
    this.query = query || {};
    options = options || {};
    _.assign(this, _.defaults(options, {
      debugPrefix: '',
      batchSize: 100,
      maxQueueLength: 50,
      queueWaitInterval: 100,
      concurrentItems: 50,
    }));
    this.itemsFrom = this.query.skip || 0;
    this.itemsTo = this.itemsFrom;
    this.limit = this.query.limit;
    this.initialized = false;
    this.itemsTotal = null;
    this.pageTotal = null;
    this.currentItem = 0;
    this.currentItems = [];
    this.queue = null;
  }

  initialize(cb = utils.createPromiseCallback()) {
    const self = this;

    if (this.initialized) {
      process.nextTick(() => {
        cb();
      });
      return cb.promise;
    }

    debug(this.debugPrefix, 'Initializing');
    const countWhere = self.query.where || {};

    this.Model.count(countWhere).then((count) => {
      self.itemsTotal = self.limit ? Math.min(count, self.limit) : count;
      self.pageTotal = Math.ceil(self.itemsTotal / self.batchSize);
      self.initialized = true;
      cb();
    }).catch(cb);

    return cb.promise;
  }

  next(cb = utils.createPromiseCallback()) {
    // If we are already at the end, return nothing,
    if (this.initialized && this.currentItem >= this.itemsTotal) {
      process.nextTick(() => {
        cb(null);
      });
      return cb.promise;
    }
    // Otherwise, return the next result.
    this._getNextValue().then((value) => {
      cb(null, value);
    }).catch(cb);
    return cb.promise;
  }

  _getNextValue(cb = utils.createPromiseCallback()) {
    const self = this;

    // If we already have some results, return the next one.
    if (this.currentItems.length) {
      process.nextTick(() => {
        self.currentItem++;
        cb(null, self.currentItems.shift());
      });
      return cb.promise;
    }

    // Fetch the next page of results if there are some.
    const memory = 1024;

    debug(`${ self.debugPrefix }Fetching next batch. Current item: %s : Memory usage: %s`,
        this.currentItem, (process.memoryUsage().heapUsed / memory / memory).toFixed(2), 'Mb');

    this.initialize().then(() => {
      self.query.skip = self.itemsTo;
      self.query.limit = self.batchSize;
      return self.Model.find(_.clone(self.query));
    }).then((data) => {
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

  forEachAsync(func, cb = utils.createPromiseCallback()) {
    const self = this;

    debug(`${ self.debugPrefix }Total items to process: %s`, this.itemsTotal);

    // Create a queue that will process upto concurrentItems concurrent items using func.
    this.queue = async.queue(func, this.concurrentItems);

    // Iterate over the records.
    iterators.forEachAsync(this, (err, item, next) => {
      if (err) {
        return next();
      }

      // Queue each item for processing.
      self.queue.push({
        item,
        self,
      });
      // Prevent the queue from adding more items that it can process concurrently.
      async.whilst(() => {
        return self.queue.length() > self.maxQueueLength;
      }, (callback) => {
        setTimeout(callback, self.queueWaitInterval);
      }, () => {
        process.nextTick(() => {
          next();
        });
      });
    }, () => {
      // The last item from the iterator has been processed.
      // Wait for the queue finish processong items before moving on.
      async.whilst(self.queue.running, (callback) => {
        setTimeout(callback, self.queueWaitInterval);
      }, cb);
    });

    return cb.promise;
  }
}
