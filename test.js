/* jshint mocha: true */

var debug = require('debug')('loopback-ds-iterator-mixin');

var loopback = require('loopback');
var lt = require('loopback-testing');

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var sinon = require('sinon');
chai.use(require('sinon-chai'));
require('mocha-sinon');

// Create a new loopback app.
var app = loopback();

// Set up promise support for loopback in non-ES6 runtime environment.
global.Promise = require('bluebird');

// import our Changed mixin.
require('./')(app);

// Configure datasource
dbConnector = loopback.memory();

describe('loopback datasource iterator mixin', function () {

  beforeEach(function (done) {

    // A model with 2 Changed properties.
    var Item = this.Item = loopback.PersistedModel.extend('item', {
      name: String,
      description: String,
      status: String
    }, {
      mixins: {
        Iterator: {
          options: {
            itemsPerPage: '3'
          }
        }
      }
    });

    Item.attachTo(dbConnector);
    app.model(Item);

    app.use(loopback.rest());
    app.set('legacyExplorer', false);
    done();
  });

  lt.beforeEach.withApp(app);

  for (var i = 1; i <= 50; i++) {
    lt.beforeEach.givenModel('item', {
      name: 'Item' + i,
      description: 'This is item with id' + i,
      status: i % 2? 'active' : 'disabled'
    }, 'item' + i);
  }

  describe('Model.find', function () {

    it('Default find operation.', function (done) {
      this.Item.find().then(function (result) {
        assert.equal(result.length, 50, 'Should return all items');
        done();
      });
    });

  });

  describe('Model.iterate', function () {
    it('should add an iterate method', function (done) {
      assert.equal(typeof this.Item.iterate, 'function');
      done();
    });
    it('should iterate when calling next()', function (done) {
      var iterator = this.Item.iterate();
      iterator
        .next()
        .then(function (item) {
          assert.equal(item.name, 'Item1');
          return iterator.next();
        })
        .then(function (item) {
          assert.equal(item.name, 'Item2');
          return iterator.next();
        })
        .then(function (item) {
          assert.equal(item.name, 'Item3');
          return iterator.next();
        })
        .then(function (item) {
          assert.equal(item.name, 'Item4');
          done();
        });
    });
  });

  describe('Model.iterate', function () {
    it('should include the total count and current pager details', function (done) {
      var iterator = this.Item.iterate();
      assert.equal(iterator.currentItem, 0);
      assert.equal(Array.isArray(iterator.currentItems), true);
      assert.equal(iterator.currentItems.length, 0);
      done();
    });
  });

});
