## PsychoDB Controller

### Setup

You have to install this via GitHub.

```
$ npm install --save west-suken/psycho-db-controller
```

Or via yarn:

```
$ yarn add west-suken/psycho-db-controller
```

### Use

```js
const db = require('west-suken/psycho-db-controller')

// you have to initialize db before using it

db.initializeApp(auth => {
  // authentication needed
  // ex: return auth.signInWithEmailAndPassword('xxx', 'xxx')
}, {
  // config
  firebase: {
    // firebase config
  },
  // collectionName: optional
  collectionName: 'hoge-test'
})
```
