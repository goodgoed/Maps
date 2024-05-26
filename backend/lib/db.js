const PG = require('pg');

async function connect_db() {
  const pool = new PG.Pool({
    user: 'postgres',
    password: 'mysecretpassword',
    host: 'db',
    database: 'gis',
  });
  const client = await pool.connect();

  return client;
}

module.exports = connect_db;
