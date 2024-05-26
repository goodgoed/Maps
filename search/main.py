from fastapi import FastAPI, HTTPException
from pathlib import Path
from pydantic import BaseModel
import nominatim.api as napi
from nominatim.api import DataLayer
import math

# Define the FastAPI application
app = FastAPI()

# Configuration parameters for Nominatim
config_params = {
    'NOMINATIM_DATABASE_DSN': 'pgsql:dbname=nominatim;user=postgres;password=mysecretpassword;host=db;port=5432'
}

# Initialize the Nominatim API
api = napi.NominatimAPIAsync(Path('.'), environ=config_params)

# Pydantic models for request validation
class BoundingBox(BaseModel):
    minLat: float
    minLon: float
    maxLat: float
    maxLon: float

class SearchQuery(BaseModel):
    bbox: BoundingBox
    onlyInBox: bool
    searchTerm: str

class AddressQuery(BaseModel):
    lat: float
    lon: float

@app.post("/api/search/")
async def search(query: SearchQuery):
    def cosineDistanceBetweenPoints(lat1, lon1, lat2, lon2):
        R = 6371e3
        p1 = (lat1 * math.pi) / 180
        p2 = (lat2 * math.pi) / 180
        deltaP = p2 - p1
        deltaLon = lon2 - lon1
        deltaLambda = (deltaLon * math.pi) / 180
        a = math.sin(deltaP / 2) * math.sin(deltaP / 2) + math.cos(p1) * math.cos(p2) * math.sin(deltaLambda / 2) * math.sin(deltaLambda / 2)
        d = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)) * R
        return d

    def calculateDistance(location, center):
        return cosineDistanceBetweenPoints(
            center[0],
            center[1],
            location.lat,
            location.lon
        )

    print(f'Received /api/search request: {query.searchTerm} {query.bbox.minLat} {query.bbox.minLon} {query.bbox.maxLat} {query.bbox.maxLon}')
    try:
        response = await api.search(query.searchTerm, bounded_viewbox=True if query.onlyInBox else False, viewbox=f"{query.bbox.minLon},{query.bbox.maxLat},{query.bbox.maxLon},{query.bbox.minLat}", max_results=30, layers=DataLayer.ADDRESS | DataLayer.POI | DataLayer.RAILWAY | DataLayer.NATURAL | DataLayer.MANMADE, address_details = True)

        box_center = [
            (query.bbox.minLat + query.bbox.maxLat) / 2,
            (query.bbox.minLon + query.bbox.maxLon) / 2,
        ]
        result = []

        if query.onlyInBox:
            for item in response:
                result.append({
                    "name": item.display_name if item.display_name else f"{item.address['housenumber']} {item.address['street']}, {item.address['city']}, {item.address['state']}",
                    "coordinates": {
                        "lat": item.centroid.lat,
                        "lon": item.centroid.lon
                    },
                    "bbox": {
                        "minLat": query.bbox.minLat,
                        "minLon": query.bbox.minLon,
                        "maxLat": query.bbox.maxLat,
                        "maxLon": query.bbox.maxLon
                    },
                    "distance": calculateDistance(item, box_center)
                })
        else:
            for item in response:
                result.append({
                    "name": item.display_name if item.display_name else f"{item.address['housenumber']} {item.address['street']}, {item.address['city']}, {item.address['state']}",
                    "coordinates": {
                        "lat": item.centroid.lat,
                        "lon": item.centroid.lon
                    },
                    "bbox": {
                        "minLat": item.bbox.minlat,
                        "minLon": item.bbox.minlon,
                        "maxLat": item.bbox.maxlat,
                        "maxLon": item.bbox.maxlon
                    },
                    "distance": calculateDistance(item, box_center)
                })
        result.sort(key=lambda p: p['distance'])
        for item in result:
            del item['distance']
        result.extend(result)
        return result

    except Exception as E:
        print(E)
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.post('/api/address')
async def get_address(data: AddressQuery):
    print('Received /api/address request')
    coordinate = (float(data.lon), float(data.lat))

    try:
        response = await api.reverse(coordinate)
        print(response)

        address = {
            'number': response.address.get('housenumber'),
            'street': response.address.get('street'),
            'city': response.address.get('city'),
            'state': response.address.get('state'),
            'country': response.country_code.upper(),
        }
        return address

    except Exception as err:
        print(err)
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/")
def read_root():
    return {"Hello": "World"}
