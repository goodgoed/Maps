import http from 'k6/http';
import { sleep } from 'k6';

/**
 * Parameters for the load testing
 * 1) Number of Virtual Users (VUs)
 * 2) Response time
 * 3) Percentage of getting specific location (currently set to 90%)
 */

// Read by K6 during init stage
export const options = {
  stages: [ // M3 Target
    { duration: '30s', target: 50 }, // ramp up to 50 users over 30s
    { duration: '30s', target: 100 }, // ramp up to 100 users over 30s
    { duration: '1m', target: 150 }, // ramp up to 150 users over 1 minute
    { duration: '4m', target: 150 }, // stay at 150 users for 4 minutes
    { duration: '10s', target: 0 }, // ramp down to 0 users
  ],
  /* stages: [ // M4 Target
    { duration: '1m', target: 100 }, // ramp up to 150 users over 1 minute
    { duration: '1m', target: 250 }, // ramp up to 250 users over 1 minute
    { duration: '2m', target: 500 }, // ramp up to 500 users over 2 minutes
    { duration: '3m', target: 1000 }, // ramp up to 1000 users over 3 minutes
    { duration: '3m', target: 1500 }, // ramp up to 1500 users over 3 minutes
    { duration: '3m', target: 1500 }, // stay at 1500 users for 3 minutes
    { duration: '15s', target: 0 }, // ramp down to 0 users
  ], */
  thresholds: {
    http_req_duration: ['p(95)<250'], // 95% of requests must complete below 250ms
  },
};

const boundingBoxes = {
  'Stony Brook': [
    [-73.147, 40.899],
    [-73.105, 40.935],
  ],
  Boston: [
    [-71.191, 42.227],
    [-70.994, 42.4],
  ],
  'New York City': [
    [-74.259, 40.477],
    [-73.7, 40.917],
  ],
  Philadelphia: [
    [-75.28, 39.867],
    [-74.955, 40.137],
  ],
  'Region': [
    [-80.31, 39.08],
    [-66.85, 47.48]
  ]
};

/**
 * @returns a random coordinate within the given bounding box
 */
function getRandomCoordinate(box) {
  const lon = Math.random() * (box[1][0] - box[0][0]) + box[0][0];
  const lat = Math.random() * (box[1][1] - box[0][1]) + box[0][1];
  return [lon, lat];
}

/**
 * @returns 99% of the time, return the value of the key in the object, otherwise return a value from random keys.
 */
function chooseValue(obj, key) {
  let keys = Object.keys(obj);
  if (key) {
    if (Math.random() < 0.99) {
      return obj[key];
    } else {
      // Filter out the selected key
      keys = keys.filter(k => k !== key);
      // Randomly select from the remaining keys
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      return obj[randomKey];
    }
  } else {
    return obj[keys[Math.floor(Math.random() * keys.length)]];
  }
}

/**
 * 1. Each VU will pick a random location and request tiles near the area
 * 2. Each VU will try login with given credentials
 * 3. Each VU will try to search routes for random locations
 * 4. Each VU will try to request tiles for the routes
 */
export default function () {
  const baseUrl =
    __ENV.NODE_ENV === 'production'
      ? 'http://mygroop.cse356.compas.cs.stonybrook.edu'
      : 'http://localhost';
  const bbox = chooseValue(boundingBoxes, 'Region');
  const source = getRandomCoordinate(bbox);
  const zoom = Math.floor(Math.random() * 13) + 6; // Random zoom level between 6 and 18

  // Convert lat, lon to tile coordinates
  let payload = JSON.stringify({
    lat: source[1],
    long: source[0],
    zoom,
  });
  const { x_tile, y_tile } = http
    .post(`${baseUrl}/convert`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .json();

  console.log(`Requesting tiles for ${x_tile}, ${y_tile}`);

  // Get tiles (3x3 grid)
  for (let x_offset = -1; x_offset <= 1; x_offset++) {
    for (let y_offset = -1; y_offset <= 1; y_offset++) {
      const x = x_tile + x_offset;
      const y = y_tile + y_offset;

      http.get(`${baseUrl}/tiles/${zoom}/${x}/${y}.png`);
    }
  }

  if (Math.random() < 0.05) { // Only try routes 15% of the time
    // Search routes
    const destination = getRandomCoordinate(
      chooseValue(boundingBoxes, 'Stony Brook')
    );
    payload = JSON.stringify({
      source: {
        lat: source[1],
        lon: source[0],
      },
      destination: {
        lat: destination[1],
        lon: destination[0],
      },
    });
    console.log(`Searching routes for ${source} -> ${destination}`);
    const routes = http
      .post(`${baseUrl}/api/route`, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .json();

    for (const route of routes) {
      const {
        coordinates: { lat, lon },
      } = route;
      const { x_tile, y_tile } = http
        .post(`${baseUrl}/convert`, JSON.stringify({ lat, long: lon, zoom }), {
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .json();

      http.get(`${baseUrl}/tiles/${zoom}/${x_tile}/${y_tile}.png`);
    }
  }
  sleep(1);
}
