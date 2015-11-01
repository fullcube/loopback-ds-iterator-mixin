'use strict';

const debug = require('debug')('loopback-ds-iterator-mixin');
const utils = require('loopback-datasource-juggler/lib/utils');
const assert = require('assert');
const deprecate = require('util').deprecate;
const iterators = require('async-iterators');
const async = require('async');
const _ = require('lodash');
const IteratorCls = require('./iterator.js');

function Iterator(Model, settings) {
  const mixinName = 'Iterator';
  const modelName = Model.definition.name;
  const debugPrefix = `${ mixinName }: ${ modelName }: `;

  settings = _.defaults(settings, { debugPrefix: debugPrefix });
  debug(`${ debugPrefix }Loading with config %o`, settings);

  /**
  * An iterator that will lazy load items from the Datastore.
  */
  Model.iterate = function(query, options) {
    return new IteratorCls(Model, query, _.defaults(options, settings));
  };

  /**
  * An iterator that will lazy load items from the Datastore.
  */
  Model.forEachAsync = function(query, fn, options, cb = utils.createPromiseCallback()) {
    const iterator = Model.iterate(query, options);
    iterator.forEachAsync(fn, cb);
    return cb.promise;
  };
}

module.exports = deprecate(app => {
  app.loopback.modelBuilder.mixins.define('Iterator', Iterator);
}, 'DEPRECATED: Use mixinSources, see https://github.com/mrfelton/loopback-ds-iterator-mixin#mixinsources');
