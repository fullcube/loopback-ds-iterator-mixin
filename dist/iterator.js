'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var debug = require('debug')('loopback-ds-iterator-mixin');
var utils = require('loopback-datasource-juggler/lib/utils');
var iterators = require('async-iterators');
var async = require('async');
var _ = require('lodash');

var IteratorCls = (function () {
  function IteratorCls(Model, query, options) {
    _classCallCheck(this, IteratorCls);

    this.Model = Model;
    this.query = query || {};
    options = options || {};
    _.assign(this, _.defaults(options, {
      debugPrefix: '',
      batchSize: 100,
      maxQueueLength: 50,
      queueWaitInterval: 100,
      concurrentItems: 50
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

  _createClass(IteratorCls, [{
    key: 'initialize',
    value: function initialize() {
      var cb = arguments.length <= 0 || arguments[0] === undefined ? utils.createPromiseCallback() : arguments[0];

      var self = this;

      if (this.initialized) {
        process.nextTick(function () {
          cb();
        });
        return cb.promise;
      }

      debug(this.debugPrefix, 'Initializing');
      var countWhere = self.query.where || {};

      this.Model.count(countWhere).then(function (count) {
        self.itemsTotal = self.limit ? Math.min(count, self.limit) : count;
        self.pageTotal = Math.ceil(self.itemsTotal / self.batchSize);
        self.initialized = true;
        cb();
      }).catch(cb);

      return cb.promise;
    }
  }, {
    key: 'next',
    value: function next() {
      var cb = arguments.length <= 0 || arguments[0] === undefined ? utils.createPromiseCallback() : arguments[0];

      // If we are already at the end, return nothing,
      if (this.initialized && this.currentItem >= this.itemsTotal) {
        process.nextTick(function () {
          cb(null);
        });
        return cb.promise;
      }
      // Otherwise, return the next result.
      this._getNextValue().then(function (value) {
        cb(null, value);
      }).catch(cb);
      return cb.promise;
    }
  }, {
    key: '_getNextValue',
    value: function _getNextValue() {
      var cb = arguments.length <= 0 || arguments[0] === undefined ? utils.createPromiseCallback() : arguments[0];

      var self = this;

      // If we already have some results, return the next one.
      if (this.currentItems.length) {
        process.nextTick(function () {
          self.currentItem++;
          cb(null, self.currentItems.shift());
        });
        return cb.promise;
      }

      // Fetch the next page of results if there are some.
      var memory = 1024;

      debug(self.debugPrefix + 'Fetching next batch. Current item: %s : Memory usage: %s', this.currentItem, (process.memoryUsage().heapUsed / memory / memory).toFixed(2), 'Mb');

      this.initialize().then(function () {
        self.query.skip = self.itemsTo;
        self.query.limit = self.batchSize;
        return self.Model.find(_.clone(self.query));
      }).then(function (data) {
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
  }, {
    key: 'forEachAsync',
    value: function forEachAsync(func) {
      var cb = arguments.length <= 1 || arguments[1] === undefined ? utils.createPromiseCallback() : arguments[1];

      var self = this;

      debug(self.debugPrefix + 'Total items to process: %s', this.itemsTotal);

      // Create a queue that will process upto concurrentItems concurrent items using func.
      this.queue = async.queue(func, this.concurrentItems);

      // Iterate over the records.
      iterators.forEachAsync(this, function (err, item, next) {
        if (err) {
          return next();
        }

        // Queue each item for processing.
        self.queue.push({
          item: item,
          self: self
        });
        // Prevent the queue from adding more items that it can process concurrently.
        async.whilst(function () {
          return self.queue.length() > self.maxQueueLength;
        }, function (callback) {
          setTimeout(callback, self.queueWaitInterval);
        }, function () {
          process.nextTick(function () {
            next();
          });
        });
      }, function () {
        // The last item from the iterator has been processed.
        // Wait for the queue finish processong items before moving on.
        async.whilst(self.queue.running, function (callback) {
          setTimeout(callback, self.queueWaitInterval);
        }, cb);
      });

      return cb.promise;
    }
  }]);

  return IteratorCls;
})();

module.exports.IteratorCls = IteratorCls;