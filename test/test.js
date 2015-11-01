const path = require('path');
const loopback = require('loopback');
const lt = require('loopback-testing');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('sinon-chai'));
require('mocha-sinon');

// Create a new loopback app.
const app = loopback();

import { it, beforeEach } from 'arrow-mocha';

// Set up promise support for loopback in non-ES6 runtime environment.
global.Promise = require('bluebird');

// import our Changed mixin.
require(path.join('..', 'lib'))(app);

// Configure datasource
const dbConnector = loopback.memory();

describe('loopback datasource iterator mixin', () => {
  beforeEach((t, done) => {
    t.Item = loopback.PersistedModel.extend('item', {
      name: String,
      description: String,
      status: String,
    }, {
      mixins: {
        Iterator: {
          batchSize: 5,
          maxQueueLength: 10,
          queueWaitInterval: 100,
          concurrentItems: 25,
        },
      },
    });

    t.Item.attachTo(dbConnector);
    app.model(t.Item);

    app.use(loopback.rest());
    app.set('legacyExplorer', false);
    done();
  });

  lt.beforeEach.withApp(app);

  for (let i = 1; i <= 100; i++) {
    lt.beforeEach.givenModel('item', {
      name: `Item ${ i }`,
      description: `'This is item with id ${ i }`,
      status: i % 2 ? 'active' : 'disabled',
    }, `Item ${ i }`);
  }

  describe('mixin', () => {
    it('should provide an iterate method', (t) => {
      expect(t.Item.iterate).to.be.a('.then(() => {');
    });
    it('should provide a forEachAsync method', (t) => {
      expect(t.Item.forEachAsync).to.be.a('function');
    });
  });

  describe('Model.iterate', () => {
    it('should return an Iterator instance', (t) => {
      const iterator = t.Item.iterate();

      expect(iterator).respondTo('next');
      expect(iterator).respondTo('forEachAsync');
    });
    it('should allow overriding the default batchSize', (t) => {
      const iterator = t.Item.iterate({}, { batchSize: 5 });

      expect(iterator.batchSize).to.equal(5);
    });
  });


  describe('Model.forEachAsync', () => {
    it('should process all items sequentially when calling forEachAsync()', (t, done) => {
      let count = 1;

      t.Item.forEachAsync({}, (task, callback) => {
        setTimeout(() => {
          expect(task.item.name).to.equal(`Item ${ count }`);
          count++;
          callback();
        }, 10);
      }, {})
        .then(done)
        .catch(done);
    });
  });


  describe('IteratorCls', () => {
    it('should initialize an iterator with pager and count', (t, done) => {
      const iterator = t.Item.iterate();

      iterator.initialize()
        .then(() => {
          expect(iterator.currentItem).to.equal(0);
          expect(iterator.itemsTotal).to.equal(100);
          expect(iterator.currentItems).to.be.an('array');
          expect(iterator.currentItems).to.have.length(0);
        })
        .then(done)
        .catch(done);
    });
    it('should filter items using a where query', (t, done) => {
      const iterator = t.Item.iterate({ where: { status: 'active' } });

      iterator.initialize()
        .then(() => {
          expect(iterator.itemsTotal).to.equal(50);
        })
        .then(done)
        .catch(done);
    });
    it('should honor a query limit', (t, done) => {
      const iterator = t.Item.iterate({ limit: 2 });

      expect(iterator.limit).to.equal(2);
      iterator.next()
        .then((item) => {
          expect(item.name).to.equal('Item1');
          expect(iterator.itemsTotal).to.equal(2);
          return iterator.next();
        })
        .then((item) => {
          expect(item.name).to.equal('Item2');
          return iterator.next();
        })
        .then((item) => {
          expect(typeof item).to.equal('undefined');
        })
        .then(done)
        .catch(done);
    });
    it('should honor a query skip', (t, done) => {
      const iterator = t.Item.iterate({ skip: 2 });

      iterator.next()
        .then((item) => {
          expect(item.name).to.equal('Item3');
          expect(iterator.itemsFrom).to.equal(2);
        })
        .then(done)
        .catch(done);
    });
    it('should iterate when calling next()', (t, done) => {
      const iterator = t.Item.iterate();

      iterator.next()
        .then((item) => {
          expect(item.name).to.equal('Item1');
          return iterator.next();
        })
        .then((item) => {
          expect(item.name).to.equal('Item2');
          return iterator.next();
        })
        .then((item) => {
          expect(item.name).to.equal('Item3');
          return iterator.next();
        })
        .then((item) => {
          expect(item.name).to.equal('Item4');
        })
        .then(done)
        .catch(done);
    });
    it('should process all items sequentially when calling forEachAsync()', (t, done) => {
      const iterator = t.Item.iterate();
      let count = 1;

      iterator.forEachAsync((task, callback) => {
        setTimeout(() => {
          expect(task.item.name).to.equal(`Item${ count }`);
          count++;
          callback();
        }, 10);
      })
        .then(done)
        .catch(done);
    });
  });
});
