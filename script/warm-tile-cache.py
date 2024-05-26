import requests, sys

tile_server = 'http://localhost'

def convert_coordinates_to_tile(long, lat, zoom):
    url = f"{tile_server}/convert"
    payload = {
        "lat": lat,
        "long": long,
        "zoom": zoom
    }
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        return response.json()["x_tile"], response.json()["y_tile"]
    else:
        print("Failed to convert coordinates to tiles.")
        return None

def warmup_cache_in_bbox(tile_server, bbox, start_zoom, end_zoom):
    min_x, min_y, max_x, max_y = bbox
    for z in range(start_zoom, end_zoom + 1):
        min_tile_x, min_tile_y = convert_coordinates_to_tile(min_x, min_y, z)
        max_tile_x, max_tile_y = convert_coordinates_to_tile(max_x, max_y, z)

        print(f"min_tile_x: {min_tile_x}, min_tile_y: {min_tile_y}, max_tile_x: {max_tile_x}, max_tile_y: {max_tile_y}")
        
        for x in range(min_tile_x, max_tile_x + 1):
            for y in range(min_tile_y, max_tile_y + 1):
                url = f"{tile_server}/tiles/{z}/{x}/{y}.png"
                try:
                    response = requests.get(url)
                    if response.status_code == 200:
                        print(f"Warmed: {url}")
                    else:
                        print(f"Failed to load: {url}", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to load: {url}", file=sys.stderr)
                    print(e, file=sys.stderr)

# ENTIRE REGION
bbox = [-80.96, 47.37, -66.88, 37.70] # bbox = [min_lon, min_lat, max_lon, max_lat]
start_zoom = 6
end_zoom = 15
warmup_cache_in_bbox(tile_server, bbox, start_zoom, end_zoom)


# LONG ISLAND
bbox = [-74.71, 41.41, -71.7, 40.33]
start_zoom = 16
end_zoom = 18
warmup_cache_in_bbox(tile_server, bbox, start_zoom, end_zoom)
