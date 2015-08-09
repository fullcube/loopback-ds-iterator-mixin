ITERATOR
=============

This module is designed for the [Strongloop Loopback](https://github.com/strongloop/loopback) framework. It provides a mixin that makes it easy to iterate through large data sets without leaving a large memory footprint.

Data is fetched in batches, with each batch lazy-loading only when needed. The batch size can be configured by setting the `batchSize` config options.

INSTALL
=============

```bash
npm install --save loopback-ds-iterator-mixin
```

MIXINSOURCES
=============
With [loopback-boot@v2.8.0](https://github.com/strongloop/loopback-boot/)  [mixinSources](https://github.com/strongloop/loopback-boot/pull/131) have been implemented in a way which allows for loading this mixin without changes to the `server.js` file previously required.

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
      "../node_modules/loopback-ds-iterator-mixin",
      "../common/mixins"
    ]
  }
}
```

SERVER.JS
=============

DEPRECATED: See MIXINSOURCES above for configuration. Use this method ONLY if you cannot upgrade to loopback-boot@v2.8.0.

In your `server/server.js` file add the following line before the `boot(app, __dirname);` line.

```javascript
...
var app = module.exports = loopback();
...
// Add Iterator Mixin to loopback
require('loopback-ds-iterator-mixin')(app);

boot(app, __dirname, function(err) {
  'use strict';
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
```

CONFIG
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

The number of items to fetch per page is configurable.  To use different values for the default (100) add the following parameters to the mixin options.

In this example we set `batchSize` to 1000.


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
        "batchSize": 1000
      }
    }
  }
```

USAGE
=============

An `iterate` method will be added to your model class that can be used to iterate over the
results of a find query.

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

You can override the default number of items per page (as defined in the mixin configuration) by setting `batchSize` in the optional `settings` parameter.

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
  DEBUG='loopback-ds-iterator-mixin' npm test
```
