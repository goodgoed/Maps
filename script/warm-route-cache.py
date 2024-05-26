import requests
import sys
import numpy as np

# Correct the API URL if needed
API_URL = 'http://localhost/api/route'  # Ensure this is correct
# LAT_RANGE = (40.0, 43.0, 0.1)  # Start, stop, step
LAT_RANGE = (43.1, 45.9, 0.1)  # Start, stop, step
LON_RANGE = (-73.0, -79.9, -0.1)  # Start, stop, step

def warm_cache():
    lat_start, lat_stop, lat_step = LAT_RANGE
    lon_start, lon_stop, lon_step = LON_RANGE

    total_requests = ((lat_stop - lat_start) / lat_step + 1) * ((lon_stop - lon_start) / lon_step + 1)
    print(f"Expected to make {int(total_requests)} requests to warm up the cache.", file=sys.stderr)

    current_request = 1
    for srcLat in np.arange(lat_start, lat_stop, lat_step):
        for srcLon in np.arange(lon_start, lon_stop, lon_step):
            for dstLat in np.arange(lat_start, lat_stop, lat_step):
                for dstLon in np.arange(lon_start, lon_stop, lon_step):
                    payload = {
                        "source": {"lat": srcLat, "lon": srcLon},
                        "destination": {"lat": dstLat, "lon": dstLon}
                    }
                    try:
                        response = requests.post(API_URL, json=payload)
                        if response.status_code == 200:
                            print(f"WARMED - Request {current_request}: {srcLat}, {srcLon} to {dstLat}, {dstLon}")
                        else:
                            print(f"ERROR - Request {current_request}: {srcLat}, {srcLon} to {dstLat}, {dstLon} returned {response.status_code}", file=sys.stderr)
                    except requests.exceptions.RequestException as e:
                        print(f"FAILED - Request {current_request}: {srcLat}, {srcLon} to {dstLat}, {dstLon}\n{str(e)}", file=sys.stderr)
                    current_request += 1

if __name__ == '__main__':
    warm_cache()