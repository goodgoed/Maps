const express = require('express');
const memcached = require('../lib/memcached_client');
const connect_db = require('../lib/db');

router = express.Router();

// router.use((req, res, next) => {
//   if (!req.session.username) {
//     console.warn('Received unauthorized request');
//     return res.status(200).json({ status: 'ERROR', message: 'Unauthorized' });
//   }

//   next();
// });

router.post('/route', async (req, res) => {
  function round_number(num) {
    return Math.round(num * 10) / 10;
  }

  console.log('Received /route request');

  const { source, destination } = req.body;
  let { lat: srcLat, lon: srcLon } = source;
  let { lat: dstLat, lon: dstLon } = destination;

  // Do rounding to 1 decimal places
  srcLat = round_number(srcLat);
  srcLon = round_number(srcLon);
  dstLat = round_number(dstLat);
  dstLon = round_number(dstLon);

  // Check if source to destination key exists in cache
  let cacheKey = `${srcLat};${srcLon};${dstLat};${dstLon}`;
  let data;
  try {
    console.log('Checking cache: ', cacheKey);
    data = await memcached.get(cacheKey);
  } catch (err) {
    console.error('Error fetching from cache', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }

  let source_id, target_id;
  if (!data) {
    console.log('Cache miss');
    // If the key does not exist in cache, execute the query to find the node_id
    const client = await connect_db();
    let sql = `
      WITH source AS (
        SELECT source AS source_id
        FROM us_northeast_2po_4pgr
        ORDER BY geom_way <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
        LIMIT 1
      ),
      destination AS (
        SELECT source AS target_id
        FROM us_northeast_2po_4pgr
        ORDER BY geom_way <-> ST_SetSRID(ST_MakePoint($4, $3), 4326)
        LIMIT 1
      )
      SELECT source_id, target_id FROM source, destination;
    `;
    let { rows } = await client.query(sql, [srcLat, srcLon, dstLat, dstLon]);
    console.log('Query executed successfully');
    client.release();
    source_id = rows[0].source_id;
    target_id = rows[0].target_id;
    memcached.set(cacheKey, `${source_id};${target_id}`, 2592000);
    cacheKey = `${source_id};${target_id}`;
  } else {
    cacheKey = data;
  }

  // Check if the source to destination key exists in cache
  console.log('Checking cache: ', cacheKey);
  try {
    data = await memcached.get(cacheKey);
  } catch (err) {
    console.error('Error fetching from cache', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  // If the key exists in cache, return the route
  if (data) {
    console.log('Cache hit');
    return res
      .set('Cache-Control', 'public, max-age=2592000')
      .set('Content-Type', 'application/json')
      .status(200)
      .send(data);
  }

  console.log('Cache miss');
  // If the key does not exist in cache, execute the query to find the route
  sql = `
  SELECT *
  FROM pgr_dijkstra(
    format('
      SELECT id, source, target, cost, reverse_cost
      FROM us_northeast_2po_4pgr as e,
      (
        SELECT ST_Expand(ST_Extent(geom_way),0.1) as box
        FROM us_northeast_2po_4pgr as b
        WHERE b.source = %L OR b.source = %L
      ) as box
      WHERE e.geom_way && box.box',
      $1::integer, $2::integer
    ),
    array[$1::integer], array[$2::integer], FALSE
  ) AS di
  JOIN us_northeast_2po_4pgr AS w ON di.edge = w.id;
`;
  try {
    console.log('Executing query');
    const client = await connect_db();
    const query_res = await client.query(sql, [source_id, target_id]);
    console.log('Query executed successfully');
    const route = query_res.rows.map(row => ({
      description: `Step ${row.seq} (${row.osm_name}): Turn ${row.turn_direction} Move to node ${row.node} via edge ${row.edge}. Distance: ${row.distance}, Cost: ${row.cost}, Aggregate cost: ${row.agg_cost}`,
      coordinates: {
        lat: parseFloat(row.y2),
        lon: parseFloat(row.x2),
      },
    }));
    const noDuplicates = route.filter((step, index, self) => {
      return (
        index ===
        self.findIndex(t => {
          return (
            t.coordinates.lat === step.coordinates.lat &&
            t.coordinates.lon === step.coordinates.lon
          );
        })
      );
    });
    memcached.set(cacheKey, JSON.stringify(noDuplicates), 2592000);

    client.release();
    return res
      .set('Cache-Control', 'public, max-age=2592000')
      .status(200)
      .json(noDuplicates);
  } catch (error) {
    console.error('Error executing query', error);
    client.release();
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// router.post('/route/full', async (req, res) => {
//   const { source, destination } = req.body;
//   const { lat: srcLat, lon: srcLon } = source;
//   const { lat: dstLat, lon: dstLon } = destination;
//   const client = await connect_db();
//   const sql = `
//   WITH source AS (
//     SELECT source AS source_id
//     FROM us_northeast_2po_4pgr
//     ORDER BY geom_way <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
//     LIMIT 1
//   ),
//   destination AS (
//     SELECT target AS target_id
//     FROM us_northeast_2po_4pgr
//     ORDER BY geom_way <-> ST_SetSRID(ST_MakePoint($4, $3), 4326)
//     LIMIT 1
//   ),
//   route AS (
//     SELECT * FROM pgr_dijkstra(
//       'SELECT id, source, target, cost, reverse_cost FROM us_northeast_2po_4pgr',
//       (SELECT source_id FROM source),
//       (SELECT target_id FROM destination),
//       FALSE
//     )
//   )
//   SELECT
//     r.seq, r.node, r.edge, r.cost, r.agg_cost,
//     ST_Length(w.geom_way::geography) AS distance,
//     ST_AsGeoJSON(w.geom_way) AS geomjson,
//     ST_X(ST_StartPoint(w.geom_way)) AS start_lon,
//     ST_Y(ST_StartPoint(w.geom_way)) AS start_lat,
// 	  ST_X(ST_EndPoint(w.geom_way)) AS end_lon,
//     ST_Y(ST_EndPoint(w.geom_way)) AS end_lat
//   FROM route r
//   JOIN us_northeast_2po_4pgr w ON r.edge = w.id;
//   `;

//   try {
//     const query_res = await client.query(sql, [srcLat, srcLon, dstLat, dstLon]);
//     const route = query_res.rows.map(row => ({
//       description: `Step ${row.seq} (${row.name}): Move to node ${row.node} via edge ${row.edge}. Cost: ${row.cost}, Aggregate cost: ${row.agg_cost}`,
//       edge: [
//         [row.start_lon, row.start_lat],
//         [row.end_lon, row.end_lat],
//       ],
//       geoJson: JSON.parse(row.geomjson),
//       distance: row.distance,
//     }));

//     client.release();
//     res.setHeaders('Cache-Control', 'public, max-age=7200');
//     return res.status(200).json(route);
//   } catch (error) {
//     console.error('Error executing query', error);
//     client.release();
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

module.exports = router;
