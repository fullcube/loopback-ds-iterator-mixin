var debug = require('debug')('loopback-ds-iterator-mixin');
var utils = require('loopback-datasource-juggler/lib/utils');
var assert = require('assert');
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
  Model.iterate = function(query) {
    return new Model.Iterator(query);
  };

  Model.Iterator = function(query) {
    var self = this;
    self.query = query || {};
    self.itemsTotal = -1;
    self.pageTotal = -1;
    self.itemsPerPage = parseInt(options.itemsPerPage) || 25;
    self.itemsFrom = 0;
    self.itemsTo = 0;
    self.limit = this.query.limit;
    self.currentItem = 0;
    self.currentItems = [];
  };

  Model.Iterator.prototype.initialize = function(cb) {
    cb = cb || utils.createPromiseCallback();
    var self = this;

    var countWhere = self.query.where || {};
    Model.count(countWhere)
      .then(function(count) {
        self.itemsTotal = self.limit ? Math.max(count, self.limit) : count;
        self.pageTotal = Math.ceil(self.itemsTotal / self.itemsPerPage);
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
    self.getNextValue()
      .then(function(value) {
        cb(null, value);
      })
      .catch(cb);

    return cb.promise;
  };

  Model.Iterator.prototype.getNextValue = function(cb) {
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
      self.query.limit = self.itemsPerPage;

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

module.exports = function mixin(app) {
  app.loopback.modelBuilder.mixins.define('Iterator', Iterator);
};
