ITERATOR
=============

This module is designed for the [Strongloop Loopback](https://github.com/strongloop/loopback) framework.
It provides a mixin that makes it easy to iterate through large data sets without leaving a large
memory footprint.

Data is fetched in batches, with each batch lazy-loading only when needed. The batch size can be
configured by setting the `itemsPerPage` config options.

INSTALL
=============

```bash
npm install --save loopback-ds-iterator-mixin
```

SERVER.JS
=============

In your `server/server.js` file add the following line before the
`boot(app, __dirname);` line.

```javascript
...
var app = module.exports = loopback();
...
// Add Readonly Mixin to loopback
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
        "Iterator": {
            "itemsPerPage": 10
        }
    }
}
```

Usage
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
