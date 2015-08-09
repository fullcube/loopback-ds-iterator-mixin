var debug = require('debug')('loopback-ds-iterator-mixin');
var utils = require('loopback-datasource-juggler/lib/utils');
var assert = require('assert');
var deprecate = require('util').deprecate;
var _ = require('lodash');

function Iterator(Model, options) {
  'use strict';

  var mixinName = 'Iterator';
  var modelName = Model.definition.name;
  var debugPrefix = mixinName + ': ' + modelName + ': ';
  debug(debugPrefix + 'Loading with config %o', options);

  /**
   * An iterator that will lazy load items from the Datastore.
   */
  Model.iterate = function(query, settings) {
    return new Model.Iterator(query, settings);
  };

  Model.Iterator = function(query, settings) {
    var self = this;
    self.query = query || {};
    settings = settings || {};

    self.batchSize = parseInt(settings.batchSize) || parseInt(options.batchSize) || 25;

    self.itemsTotal = -1;
    self.pageTotal = -1;
    self.itemsFrom = self.query.skip || 0;
    self.itemsTo = self.itemsFrom;
    self.limit = self.query.limit;
    self.currentItem = 0;
    self.currentItems = [];
  };

  Model.Iterator.prototype.initialize = function(cb) {
    cb = cb || utils.createPromiseCallback();
    var self = this;

    var countWhere = self.query.where || {};
    Model.count(countWhere)
      .then(function(count) {
        self.itemsTotal = self.limit ? Math.min(count, self.limit) : count;
        self.pageTotal = Math.ceil(self.itemsTotal / self.batchSize);
        cb();
      })
      .catch(cb);

    return cb.promise;
  };

  Model.Iterator.prototype.next = function(cb) {
    cb = cb || utils.createPromiseCallback();
    var self = this;

    // If we are already at the end, return nothing,
    if (self.itemsTotal > -1 && self.currentItem >= self.itemsTotal) {
      cb(null);
    }

    // Otherwise, return the next result.
    self._getNextValue()
      .then(function(value) {
        cb(null, value);
      })
      .catch(cb);

    return cb.promise;
  };

  Model.Iterator.prototype._getNextValue = function(cb) {
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
    debug(debugPrefix, 'Fetching next batch. Current item: %s : Memory usage: %s',
      self.currentItem, (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'Mb');

    new Promise(function(resolve, reject) {
      // If this is the first time here, count the results.
      if (self.itemsTotal === -1) {
        self.initialize()
          .then(resolve)
          .catch(reject);
      } else {
        resolve();
      }
    })
    .then(function() {
      self.query.skip = self.itemsTo;
      self.query.limit = self.batchSize;

      return Model.find(_.clone(self.query));
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

}

module.exports = deprecate(function mixin(app) {
  app.loopback.modelBuilder.mixins.define('Iterator', Iterator);
}, 'DEPRECATED: Use mixinSources, see https://github.com/mrfelton/loopback-ds-iterator-mixin#mixinsources');
