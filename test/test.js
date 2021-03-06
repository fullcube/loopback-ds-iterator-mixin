'use strict'

const path = require('path')
const loopback = require('loopback')
const lt = require('loopback-testing')
const chai = require('chai')
const { expect } = chai

chai.use(require('dirty-chai'))

// Create a new loopback app.
const app = loopback()

// import our mixin.
require(path.join('..', 'lib'))(app)

// Configure datasource.
const dbConnector = loopback.memory()

const Item = loopback.PersistedModel.extend('item', {
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
})

Item.attachTo(dbConnector)
app.model(Item)

app.use(loopback.rest())
app.set('legacyExplorer', false)

describe('loopback datasource iterator mixin', function() {

  lt.beforeEach.withApp(app)

  for (let i = 1; i <= 100; i++) {
    lt.beforeEach.givenModel('item', {
      name: `Item${i}`,
      description: `This is item with id${i}`,
      status: i % 2 ? 'active' : 'disabled',
    }, `item${i}`)
  }

  describe('mixin', function() {
    it('should provide an iterate method', function() {
      expect(Item.iterate).to.be.a('function')
    })
    it('should provide a forEachAsync method', function() {
      expect(Item.forEachAsync).to.be.a('function')
    })
  })

  describe('Model.iterate', function() {
    it('should return an Iterator instance', function() {
      const iterator = Item.iterate()

      expect(iterator).respondTo('next')
      expect(iterator).respondTo('forEachAsync')
    })
    it('should allow overriding the default batchSize', function() {
      const iterator = Item.iterate({}, { batchSize: 5 })

      expect(iterator.batchSize).to.equal(5)
    })
  })


  describe('Model.forEachAsync', function() {
    it('should process all items sequentially when calling forEachAsync()', function(done) {
      let count = 1

      function fn(task, callback) {
        setTimeout(function() {
          expect(task.item.name).to.equal(`Item${count}`)
          count++
          callback()
        }, 10)
      }

      Item.forEachAsync({}, fn, {})
        .then(function() {
          done()
        })
        .catch(done)
    })
  })


  describe('IteratorCls', function() {
    it('should initialize an iterator with pager and count', function(done) {
      const iterator = Item.iterate()

      iterator.initialize()
        .then(function() {
          expect(iterator.currentItem).to.equal(0)
          expect(iterator.itemsTotal).to.equal(100)
          expect(iterator.currentItems).to.be.an('array')
          expect(iterator.currentItems).to.have.length(0)
          done()
        })
        .catch(done)
    })
    it('should filter items using a where query', function(done) {
      const iterator = Item.iterate({ where: { status: 'active' } })

      iterator.initialize()
        .then(function() {
          expect(iterator.itemsTotal).to.equal(50)
          done()
        })
        .catch(done)
    })
    it('should honor a query limit', function(done) {
      const iterator = Item.iterate({ limit: 2 })

      expect(iterator.limit).to.equal(2)
      iterator.next()
        .then(function(item) {
          expect(item.name).to.equal('Item1')
          expect(iterator.itemsTotal).to.equal(2)
          return iterator.next()
        })
        .then(function(item) {
          expect(item.name).to.equal('Item2')
          return iterator.next()
        })
        .then(function(item) {
          expect(item).to.be.undefined()
          done()
        })
        .catch(done)
    })
    it('should honor a query skip', function(done) {
      const iterator = Item.iterate({ skip: 2 })

      iterator.next()
        .then(function(item) {
          expect(item.name).to.equal('Item3')
          expect(iterator.itemsFrom).to.equal(2)
          done()
        })
        .catch(done)
    })
    it('should iterate when calling next()', function(done) {
      const iterator = Item.iterate()

      iterator.next()
        .then(function(item) {
          expect(item.name).to.equal('Item1')
          return iterator.next()
        })
        .then(function(item) {
          expect(item.name).to.equal('Item2')
          return iterator.next()
        })
        .then(function(item) {
          expect(item.name).to.equal('Item3')
          return iterator.next()
        })
        .then(function(item) {
          expect(item.name).to.equal('Item4')
          done()
        })
        .catch(done)
    })
    it('should process all items sequentially when calling forEachAsync()', function(done) {
      const iterator = Item.iterate()
      let count = 1

      function fn(task, callback) {
        setTimeout(function() {
          expect(task.item.name).to.equal(`Item${count}`)
          count++
          callback()
        }, 10)
      }

      iterator.forEachAsync(fn)
        .then(function() {
          done()
        })
        .catch(done)
    })
  })

})
