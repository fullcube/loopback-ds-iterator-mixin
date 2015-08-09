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
    var Item = this.Item = loopback.PersistedModel.extend('item', {
      name: String,
      description: String,
      status: String
    }, {
      mixins: {
        Iterator: {
          itemsPerPage: '3'
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

  describe('Model.iterate', function () {
    it('should add an iterate method', function (done) {
      expect(this.Item.iterate).to.be.a('function');
      done();
    });

    it('should include the total count and current pager details', function (done) {
      this.Item.iterate()
        .then(function(iterator) {
          expect(iterator.currentItem).to.equal(0);
          expect(iterator.itemsTotal).to.equal(50);
          expect(iterator.currentItems).to.be.an('array');
          expect(iterator.currentItems).to.have.length(0);
          done();
        })
        .catch(done);
    });

    it('should filter items using a where query', function (done) {
      this.Item.iterate({where: {status: 'active'}})
        .then(function(iterator) {
          expect(iterator.itemsTotal).to.equal(25);
          done();
        })
        .catch(done);
    });

    it('should iterate when calling next()', function (done) {
        var iterator;
        this.Item.iterate()
        .then(function (res) {
          iterator = res;
          return iterator.next();
        })
        .then(function (item) {
          expect(item.name).to.equal('Item1');
          return iterator.next();
        })
        .then(function (item) {
          expect(item.name).to.equal('Item2');
          return iterator.next();
        })
        .then(function (item) {
          expect(item.name).to.equal('Item3');
          return iterator.next();
        })
        .then(function (item) {
          expect(item.name).to.equal('Item4');
          done();
        })
        .catch(done);
    });

  });

});
