'use strict';

var debug = require('debug')('loopback-ds-iterator-mixin');
var utils = require('loopback-datasource-juggler/lib/utils');
var deprecate = require('util').deprecate;
var _ = require('lodash');
var IteratorCls = require('./iterator.js');

function Iterator(Model, settings) {
  var mixinName = 'Iterator';
  var modelName = Model.definition.name;
  var debugPrefix = mixinName + ': ' + modelName + ': ';

  settings = _.defaults(settings, { debugPrefix: debugPrefix });
  debug(debugPrefix + 'Loading with config %o', settings);

  /**
  * An iterator that will lazy load items from the Datastore.
  */
  Model.iterate = function (query, options) {
    return new IteratorCls(Model, query, _.defaults(options, settings));
  };

  /**
  * An iterator that will lazy load items from the Datastore.
  */
  Model.forEachAsync = function (query, func, options) {
    var cb = arguments.length <= 3 || arguments[3] === undefined ? utils.createPromiseCallback() : arguments[3];

    var iterator = Model.iterate(query, options);

    iterator.forEachAsync(func, cb);
    return cb.promise;
  };
}

module.exports = deprecate(function (app) {
  app.loopback.modelBuilder.mixins.define('Iterator', Iterator);
}, 'DEPRECATED: Use mixinSources, see https://github.com/mrfelton/loopback-ds-iterator-mixin#mixinsources');