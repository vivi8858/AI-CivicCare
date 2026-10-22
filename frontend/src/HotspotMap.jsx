
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    const heatPoints = points.map((point) => [
      Number(point.latitude),
      Number(point.longitude),
      1,
    ]);

    const heatLayer = L.heatLayer(heatPoints, {
      radius: 35,
      blur: 25,
      maxZoom: 17,
      gradient: {
        0.2: "#3b82f6",
        0.4: "#22c55e",
        0.6: "#facc15",
        0.8: "#f97316",
        1.0: "#ef4444",
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

function FitMapBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const bounds = L.latLngBounds(
      points.map((point) => [
        Number(point.latitude),
        Number(point.longitude),
      ])
    );

    if (points.length === 1) {
      map.setView(bounds.getCenter(), 14);
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, points]);

  return null;
}

export default function HotspotMap({ points = [] }) {
  const located = points.filter((point) => {
    const lat = Number(point.latitude);
    const lng = Number(point.longitude);

    return (
      point.latitude != null &&
      point.longitude != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  });

  return (
    <div className="civic-hotspot-map">
      <MapContainer
        center={[28.6139, 77.2090]}
        zoom={11}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <HeatmapLayer points={located} />
        <FitMapBounds points={located} />

        {located.map((point, index) => (
          <CircleMarker
            key={`${point.latitude}-${point.longitude}-${index}`}
            center={[
              Number(point.latitude),
              Number(point.longitude),
            ]}
            radius={6}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: "#2563eb",
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <strong>{point.category || "Civic complaint"}</strong>
              <div>Status: {point.status || "Unknown"}</div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
