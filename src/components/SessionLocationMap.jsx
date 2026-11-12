import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isValidLocation } from "../utils/locationSharing.js";

function createParticipantIcon(name) {
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  const iconElement = document.createElement("span");
  iconElement.textContent = initial;
  iconElement.className = "session-map-marker";

  return L.divIcon({
    className: "session-map-marker-shell",
    html: iconElement.outerHTML,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function SessionLocationMap({ locations = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(new Map());
  const fittedParticipantsRef = useRef("");

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([-14.235, -51.9253], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => map.invalidateSize())
      : null;

    if (resizeObserver && containerRef.current) resizeObserver.observe(containerRef.current);
    const resizeMap = () => map.invalidateSize();
    window.addEventListener("resize", resizeMap);
    requestAnimationFrame(resizeMap);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeMap);
      layersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const validLocations = locations.filter((entry) => isValidLocation(entry));
    const currentIds = new Set(validLocations.map((entry) => entry.userId));

    layersRef.current.forEach((layer, userId) => {
      if (!currentIds.has(userId)) {
        map.removeLayer(layer);
        layersRef.current.delete(userId);
      }
    });

    validLocations.forEach((entry) => {
      const position = [entry.latitude, entry.longitude];
      const group = L.layerGroup();
      const marker = L.marker(position, { icon: createParticipantIcon(entry.name) });
      const tooltip = document.createElement("span");
      tooltip.textContent = entry.name || "Participante";
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -14] });
      marker.addTo(group);

      if (Number.isFinite(entry.accuracy) && entry.accuracy > 0) {
        L.circle(position, {
          radius: Math.min(entry.accuracy, 5_000),
          className: "session-map-accuracy",
          weight: 1,
        }).addTo(group);
      }

      const previousLayer = layersRef.current.get(entry.userId);
      if (previousLayer) map.removeLayer(previousLayer);
      group.addTo(map);
      layersRef.current.set(entry.userId, group);
    });

    if (validLocations.length > 0) {
      const participantKey = validLocations.map((entry) => entry.userId).sort().join("|");
      if (participantKey !== fittedParticipantsRef.current) {
        const bounds = L.latLngBounds(validLocations.map((entry) => [entry.latitude, entry.longitude]));
        if (bounds.isValid()) map.fitBounds(bounds.pad(validLocations.length > 1 ? 0.25 : 0.5), { maxZoom: 16 });
        fittedParticipantsRef.current = participantKey;
      }
    } else {
      fittedParticipantsRef.current = "";
    }
  }, [locations]);

  return (
    <div
      aria-label="Mapa com a localização compartilhada dos participantes"
      className="session-location-map"
      ref={containerRef}
      role="region"
    />
  );
}
