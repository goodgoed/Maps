const Memcached = require('memcached');
const util = require('util');

// const memcached = new Memcached('route-cache:11211');
const memcached = new Memcached([
  '209.151.154.222:11211',
  '209.151.151.47:11211',
  '194.113.74.105:11211',
  '194.113.74.208:11211',
  '209.151.148.105:11211',
  '209.94.58.12:11211',
]);
memcached.get = util.promisify(memcached.get);
memcached.set = util.promisify(memcached.set);

module.exports = memcached;
