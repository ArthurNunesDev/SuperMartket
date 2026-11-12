import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isValidLocation } from "../utils/locationSharing.js";
import { getSpiderfiedPositions } from "../utils/mapMarkers.js";

function createParticipantIcon(name) {
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  const iconElement = document.createElement("span");
  iconElement.textContent = initial;
  iconElement.className = "session-map-marker";

  return L.divIcon({
    className: "session-map-marker-shell",
    html: iconElement,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function SessionLocationMap({ locations = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
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
    const resizeFrame = requestAnimationFrame(resizeMap);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeMap);
      cancelAnimationFrame(resizeFrame);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const validLocations = locations.filter((entry) => isValidLocation(entry));
    const renderMarkers = () => {
      map.eachLayer((layer) => {
        if (layer.options?.pane === "markerPane" || layer.options?.pane === "overlayPane") {
          // Base tiles and controls are not stored in these panes.
        }
      });

      const markerLayers = map._sessionMarkerLayers ?? [];
      markerLayers.forEach((layer) => map.removeLayer(layer));
      map._sessionMarkerLayers = [];

      if (validLocations.length === 0) {
        fittedParticipantsRef.current = "";
        return;
      }

      const projected = validLocations.map((entry) => ({
        x: map.latLngToLayerPoint([entry.latitude, entry.longitude]).x,
        y: map.latLngToLayerPoint([entry.latitude, entry.longitude]).y,
      }));
      const displayPoints = getSpiderfiedPositions(projected);
      const layers = [];

      validLocations.forEach((entry, index) => {
        const actualPosition = L.latLng(entry.latitude, entry.longitude);
        const displayPoint = displayPoints[index];
        const displayPosition = map.layerPointToLatLng(L.point(displayPoint.x, displayPoint.y));
        const group = L.layerGroup();
        const marker = L.marker(displayPosition, { icon: createParticipantIcon(entry.name) });
        const tooltip = document.createElement("span");
        tooltip.textContent = entry.name || "Participante";
        marker.bindTooltip(tooltip, { direction: "top", offset: [0, -14] });
        marker.addTo(group);

        if (displayPosition.distanceTo(actualPosition) > 1) {
          L.polyline([actualPosition, displayPosition], {
            color: "#40534d",
            weight: 1.5,
            opacity: 0.8,
            interactive: false,
          }).addTo(group);
        }

        if (Number.isFinite(entry.accuracy) && entry.accuracy > 0) {
          L.circle(actualPosition, {
            radius: entry.accuracy,
            className: "session-map-accuracy",
            weight: 1,
          }).addTo(group);
        }

        group.addTo(map);
        layers.push(group);
      });

      map._sessionMarkerLayers = layers;

      const participantKey = validLocations.map((entry) => entry.userId).sort().join("|");
      if (participantKey !== fittedParticipantsRef.current) {
        const bounds = L.latLngBounds(validLocations.map((entry) => [entry.latitude, entry.longitude]));
        if (bounds.isValid()) map.fitBounds(bounds.pad(validLocations.length > 1 ? 0.25 : 0.5), { maxZoom: 16 });
        fittedParticipantsRef.current = participantKey;
      }
    };

    renderMarkers();
    map.on("zoomend moveend", renderMarkers);
    return () => {
      map.off("zoomend moveend", renderMarkers);
      (map._sessionMarkerLayers ?? []).forEach((layer) => map.removeLayer(layer));
      map._sessionMarkerLayers = [];
    };
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
