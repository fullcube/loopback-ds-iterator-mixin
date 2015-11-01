'use strict';

var debug = require('debug')('loopback-ds-iterator-mixin');
var utils = require('loopback-datasource-juggler/lib/utils');
var assert = require('assert');
var deprecate = require('util').deprecate;
var iterators = require('async-iterators');
var async = require('async');
var _ = require('lodash');

function Iterator(Model, settings) {
  var mixinName = 'Iterator';
  var modelName = Model.definition.name;
  var debugPrefix = mixinName + ': ' + modelName + ': ';
  settings = _.defaults(settings, {
    debugPrefix: debugPrefix
  });
  debug(debugPrefix + 'Loading with config %o', settings);

  /**
   * An iterator that will lazy load items from the Datastore.
   */
  Model.iterate = function(query, options) {
    return new IteratorCls(Model, query, _.defaults(options, settings));
  };

  /**
   * An iterator that will lazy load items from the Datastore.
   */
  Model.forEachAsync = function(query, fn, options, cb) {
    cb = cb || utils.createPromiseCallback();
    var iterator = Model.iterate(query, options);
    iterator.forEachAsync(fn, cb);
    return cb.promise;
  };

}

function IteratorCls(Model, query, options) {
  var self = this;
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

IteratorCls.prototype.initialize = function(cb) {
  cb = cb || utils.createPromiseCallback();
  var self = this;

  if (self.initialized) {
    process.nextTick(function() {
      cb();
    });
    return cb.promise;
  }

  debug(self.debugPrefix, 'Initializing');
  var countWhere = self.query.where || {};
  self.Model.count(countWhere)
    .then(function(count) {
    self.itemsTotal = self.limit ? Math.min(count, self.limit) : count;
    self.pageTotal = Math.ceil(self.itemsTotal / self.batchSize);
    self.initialized = true;
    cb();
  })
  .catch(cb);

  return cb.promise;
};

IteratorCls.prototype.next = function(cb) {
  cb = cb || utils.createPromiseCallback();
  var self = this;

  // If we are already at the end, return nothing,
  if (self.initialized && self.currentItem >= self.itemsTotal) {
    process.nextTick(function() {
      cb(null);
    });
    return cb.promise;
  }

  // Otherwise, return the next result.
  self._getNextValue()
    .then(function(value) {
      cb(null, value);
    })
    .catch(cb);

  return cb.promise;
};

IteratorCls.prototype._getNextValue = function(cb) {
  cb = cb || utils.createPromiseCallback();
  var self = this;

  // If we already have some results, return the next one.
  if (self.currentItems.length) {
    process.nextTick(function() {
      self.currentItem++;
      cb(null, self.currentItems.shift());
    });
    return cb.promise;
  }

  // Fetch the next page of results if there are some.
  debug(self.debugPrefix + 'Fetching next batch. Current item: %s : Memory usage: %s',
    self.currentItem, (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'Mb');

  self.initialize()
    .then(function() {
      self.query.skip = self.itemsTo;
      self.query.limit = self.batchSize;
      return self.Model.find(_.clone(self.query));
    })
    .then(function(data) {

      // Update the pager.
      self.itemsFrom = self.query.skip;
      self.itemsTo = self.query.skip + data.length;

      // Store the current item set.
      self.currentItems = data;

      // Return the next item.
      self.currentItem++;
      cb(null, self.currentItems.shift());
    })
    .catch(cb);

  return cb.promise;
};

IteratorCls.prototype.forEachAsync = function(fn, cb) {
  cb = cb || utils.createPromiseCallback();
  var self = this;

  debug(self.debugPrefix + 'Total items to process: %s', self.itemsTotal);

  // Create a queue that will process upto concurrentItems concurrent items using fn.
  self.queue = async.queue(fn, self.concurrentItems);

  // Iterate over the records.
  iterators.forEachAsync(self, function(err, item, cb) {

    // Queue each item for processing.
    self.queue.push({
      item: item,
      iterator: self
    });

    // Prevent the queue from adding more items that it can process concurrently.
    async.whilst(
      function() {
        return self.queue.length() > self.maxQueueLength;
      },
      function(callback) {
        setTimeout(callback, self.queueWaitInterval);
      },
      function(err) {
        process.nextTick(function() {
          cb();
        });
      }
    );

  }, function() {
    // The last item from the iterator has been processed.
    // Wait for the queue finish processong items before moving on.
    async.whilst(
      self.queue.running,
      function(callback) {
        setTimeout(callback, self.queueWaitInterval);
      },
      cb
    );
  });

  return cb.promise;
};

module.exports = deprecate(function mixin(app) {
  app.loopback.modelBuilder.mixins.define('Iterator', Iterator);
}, 'DEPRECATED: Use mixinSources, see https://github.com/mrfelton/loopback-ds-iterator-mixin#mixinsources');
