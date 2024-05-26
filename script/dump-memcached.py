import memcache
import gzip
import json
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
MEMCACHED_HOST = '127.0.0.1:11211'
OUTPUT_FILE = "memcached-data.gz"
BATCH_SIZE = 10000  # Adjust batch size based on memory constraints and performance

def fetch_all_keys(client):
    keys = []
    items = client.get_stats('items')
    for item in items:
        for slab in item[1].keys():
            if slab.startswith('items:'):
                slab_id = slab.split(':')[1]
                cachedump = client.get_stats(f'cachedump {slab_id} 0')
                for cd in cachedump:
                    keys.extend(cd[1].keys())
    return keys

def process_key_batch(key_batch, client):
    results = []
    for key in key_batch:
        value = client.get(key)
        if value is not None:
            if isinstance(value, bytes):
                try:
                    value = value.decode('utf-8')
                except UnicodeDecodeError:
                    value = base64.b64encode(value).decode('utf-8')
            elif not isinstance(value, str):
                value = json.dumps(value)
            results.append(json.dumps({key: value}))
    return results

def main():
    client = memcache.Client([MEMCACHED_HOST], debug=0)
    keys = fetch_all_keys(client)
    print(f"Found {len(keys)} keys in Memcached.")

    with gzip.open(OUTPUT_FILE, 'wt', encoding='UTF-8') as f:
        with ThreadPoolExecutor() as executor:
            future_to_batch = {executor.submit(process_key_batch, keys[i:i + BATCH_SIZE], client): i for i in range(0, len(keys), BATCH_SIZE)}
            for future in as_completed(future_to_batch):
                batch_results = future.result()
                for result in batch_results:
                    f.write(result + '\n')

    print(f"Data dumped to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
