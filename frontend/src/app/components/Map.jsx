'use client';

import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Sidebar from './Sidebar';
import MarkerIcon from 'leaflet/dist/images/marker-icon.png';
import MarkerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import MarkerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: MarkerIcon2x.src,
  iconUrl: MarkerIcon.src,
  shadowUrl: MarkerShadow.src,
});

export default function Map() {
  const [map, setMap] = useState(null);
  const [bbox, setBbox] = useState({
    minLat: null,
    maxLat: null,
    minLong: null,
    maxLong: null,
  });

  useEffect(() => {
    const newMap = L.map('map', { attributionControl: false }).setView(
      [40.824, -73.165],
      12
    );
    L.tileLayer(
      `${process.env.NEXT_PUBLIC_BACKEND_API_ENDPOINT}/tiles/{z}/{x}/{y}.png`,
      {
        maxZoom: 20,
        minZoom: 4,
        id: 'base',
      }
    ).addTo(newMap);

    updateBbox(newMap);
    newMap.on('dragend', () => {
      updateBbox(newMap);
    });
    newMap.on('moveend', () => {
      updateBbox(newMap);
    });
    setMap(newMap);

    return () => newMap.remove();
  }, []);
  function updateBbox(map) {
    const bounds = map.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    setBbox({
      minLat: southWest.lat,
      maxLat: northEast.lat,
      minLon: southWest.lng,
      maxLon: northEast.lng,
    });
  }

  return (
    <div className="flex w-full">
      <Sidebar map={map} bbox={bbox} />
      <div id="map" className="basis-8/12" style={{ height: '100vh' }} />
    </div>
  );
}
