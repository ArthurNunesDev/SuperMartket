const EARTH_RADIUS_METERS = 6_371_000;

export function isValidLocation(location) {
  return Boolean(
    location
    && Number.isFinite(location.latitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && Number.isFinite(location.longitude)
    && location.longitude >= -180
    && location.longitude <= 180
    && Number.isFinite(Date.parse(location.updatedAt))
    && (location.accuracy == null || (Number.isFinite(location.accuracy) && location.accuracy >= 0))
  );
}

export function normalizeGeolocationPosition(position, now = Date.now()) {
  const latitude = position?.coords?.latitude;
  const longitude = position?.coords?.longitude;
  const accuracy = position?.coords?.accuracy;

  const location = {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null,
    updatedAt: new Date(now).toISOString(),
  };

  return isValidLocation(location) ? location : null;
}

export function distanceBetweenLocations(first, second) {
  if (!isValidLocation(first) || !isValidLocation(second)) return Number.POSITIVE_INFINITY;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function shouldPublishLocation(
  nextLocation,
  previousLocation,
  now = Date.now(),
  minimumIntervalMs = 20_000,
  minimumDistanceMeters = 25,
) {
  if (!isValidLocation(nextLocation)) return false;
  if (!isValidLocation(previousLocation)) return true;

  const previousTimestamp = Date.parse(previousLocation.updatedAt);
  if (!Number.isFinite(previousTimestamp) || now - previousTimestamp >= minimumIntervalMs) return true;

  return distanceBetweenLocations(nextLocation, previousLocation) >= minimumDistanceMeters;
}
