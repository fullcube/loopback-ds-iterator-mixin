ITERATOR
=============

[![Greenkeeper badge](https://badges.greenkeeper.io/fullcube/loopback-ds-iterator-mixin.svg)](https://greenkeeper.io/)

[![Circle CI](https://circleci.com/gh/fullcube/loopback-ds-iterator-mixin.svg?style=svg)](https://circleci.com/gh/fullcube/loopback-ds-iterator-mixin) [![Coverage Status](https://coveralls.io/repos/fullcube/loopback-ds-iterator-mixin/badge.svg?branch=forEachAsync&service=github)](https://coveralls.io/github/fullcube/loopback-ds-iterator-mixin?branch=forEachAsync) [![Dependencies](http://img.shields.io/david/fullcube/loopback-ds-iterator-mixin.svg?style=flat)](https://david-dm.org/fullcube/loopback-ds-iterator-mixin) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

This module is designed for the [Strongloop Loopback](https://github.com/strongloop/loopback) framework. It provides a mixin that makes it easy to iterate through large data sets without leaving a large memory footprint.

Data is fetched in batches, with each batch lazy-loading only when needed. The batch size can be configured by setting the `batchSize` config options.

INSTALL
=============

```bash
npm install --save loopback-ds-iterator-mixin
```

CONFIG
=============

Add the `mixins` property to your `server/model-config.json` like the following:

```json
{
  "_meta": {
    "sources": [
      "loopback/common/models",
      "loopback/server/models",
      "../common/models",
      "./models"
    ],
    "mixins": [
      "loopback/common/mixins",
      "../node_modules/loopback-ds-iterator-mixin/lib",
      "../common/mixins"
    ]
  }
}

MODEL CONFIG
=============

To use with your Models add the `mixins` attribute to the definition object of your model config.

```json
  {
    "name": "Item",
    "properties": {
      "name": "String",
      "description": "String",
      "status": "String"
    },
    "mixins": {
      "Iterator": {}
    }
  }
```

BOOT OPTIONS
=============

The mixin provides a number of configurable values that control how and when results are fetched and processed.

The following options are available:

 - **batchSize** (default: 100)  
   Number of items to fetch from datasource per batch.

 - **maxQueueLength** (default: 50)  
   The maximum size to allow the queue length to grow to.

 - **queueWaitInterval** (default: 100)  
   The number of milliseconds to wait until checking wether the queue has drained below *maxQueueLength*.

 - **concurrentItems** (default: 50)  
   The number of concurrent items to process (used in *forEachAsync*).

To use different values for the default add the following parameters to the mixin options.

```json
  {
    "name": "Item",
    "properties": {
      "name": "String",
      "description": "String",
      "status": "String"
    },
    "mixins": {
      "Iterator": {
        "batchSize": "100",
        "maxQueueLength": "50",
        "queueWaitInterval": "100",
        "concurrentItems": "50"
      }
    }
  }
```



USAGE
=============

An `iterate` method will be added to your model class that can be used to manually iterate over the results of a find
query.

```javascript
var iterator = this.Item.iterate(query)
iterator.next()
  .then(function (item) {
    expect(item.name).to.equal('Item1');
    return iterator.next();
  })
  .then(function (item) {
    expect(item.name).to.equal('Item2');
    return iterator.next();
  })
```

Additionally, a `forEachAsync` method will be added to your model class that can be used to iterate over the
results of a find query. `maxQueueLength`, `queueWaitInterval` & `concurrentItems` options can be used to tune things.

```javascript
var fn = function(task, callback) {
  process.nextTick(function() {
    callback();
  });
}
this.Item.forEachAsync({where: { ... }}, fn, {})
  .then(function () {
    done();
  })
  .catch(done);
});
```

You can override the default configuration options such as the number of items per page (as defined in the mixin
configuration) by setting the optional `settings` parameter:

```javascript
var iterator = this.Item.iterate(query, {batchSize: 1000})
iterator.next()
  .then(function (item) {
    ...
```

TESTING
=============

Run the tests in `test.js`

```bash
  npm test
```

Run with debugging output on:

```bash
  DEBUG='loopback:mixin:iterator' npm test
```
