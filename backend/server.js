const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const app = express();
const port = 3000;

const clientPromise = mongoose
  .connect('mongodb://root:password@mongo:27017/user?authSource=admin')
  .then(m => m.connection.getClient());
const log_types = {
  log: { console: console.log, prefix: '[INFO]' },
  warn: { console: console.warn, prefix: '[WARN]' },
  debug: { console: console.debug, prefix: '[DEBUG]' },
  error: { console: console.error, prefix: '[ERROR]' },
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  // Add prefixes to console
  const request_id = req.headers['x-request-id'];
  (function () {
    Object.keys(log_types).forEach(type => {
      const original_log = log_types[type].console;
      console[type] = function (...args) {
        original_log.apply(console, [
          `${log_types[type].prefix} ${request_id} - `,
          ...args,
        ]);
      };
    });
  })();

  // Cors settings
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: 'verysecretsecretphrase',
    cookie: { maxAge: 300000 }, //session expires after 5 minutes
    store: MongoStore.create({ clientPromise, dbName: 'test' }),
  })
);

// Import routes
const searchRouter = require('./routes/search');
const tileRouter = require('./routes/tile');
const routingRouter = require('./routes/routing');
const userRouter = require('./routes/user');

// Use routes
app.use('/api', searchRouter);
app.use('/api', userRouter);
app.use('/api', routingRouter);
app.use(tileRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
