import memcache
import gzip
import json
from concurrent.futures import ThreadPoolExecutor

# Configuration
# MEMCACHED_HOST = '127.0.0.1:11211'
MEMCACHED_HOST = ['209.151.154.222:11211', '209.151.151.47:11211', '194.113.74.105:11211', '194.113.74.208:11211', '209.151.148.105:11211', '209.94.58.12:11211']
INPUT_FILE = 'memcached-data.gz'
NUM_WORKERS = 4  # Number of threads; adjust based on your environment

def load_key_value_pair(client, key, value):
    """ Load a single key-value pair into Memcached """
    client.set(key, value)
    print(f"Loaded key: {key} into Memcached.")

def load_data_to_memcached(file_path, client):
    """ Load data from a gzip file into memcached using parallel processing """
    with gzip.open(file_path, 'rt', encoding='UTF-8') as f:
        # Create a ThreadPoolExecutor for handling parallel key loading
        with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
            # Submit tasks to the executor for each key-value pair
            futures = []
            for line in f:
                data = json.loads(line)  # Parse the JSON data
                for key, value in data.items():
                    futures.append(executor.submit(load_key_value_pair, client, key, value))
            # Wait for all futures to complete
            for future in futures:
                future.result()  # You can handle exceptions here if needed

def main():
    # Connect to Memcached server
    client = memcache.Client(MEMCACHED_HOST, debug=0)
    
    # Load data from file to Memcached
    load_data_to_memcached(INPUT_FILE, client)
    print("Data has been loaded into Memcached.")

if __name__ == '__main__':
    main()
