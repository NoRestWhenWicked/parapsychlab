import axios from 'axios';

// OpenSky Network API
// Public API limitations: Anonymous users: 400 credits per day.
// GET /api/planes (proxied to https://opensky-network.org/api/states/all)
// Parameters: lamin, lomin, lamax, lomax (bounding box)

const OPENSKY_URL = '/api/planes';

export const fetchPlanes = async (minLat, minLon, maxLat, maxLon) => {
    try {
        // Construct URL with bounding box
        // const url = `${OPENSKY_URL}?lamin=${minLat}&lomin=${minLon}&lamax=${maxLat}&lomax=${maxLon}`;

        // Use a wider search or just fetch all (expensive/slow)
        // For 'sky view' we usually want planes within visible range (~300km radius?)

        // OpenSky is strict with CORS and rate limits, so we use a backend proxy.
        // If it fails, we return empty.

        const response = await axios.get(OPENSKY_URL, {
            params: {
                lamin: minLat,
                lomin: minLon,
                lamax: maxLat,
                lomax: maxLon
            },
            timeout: 5000
        });

        return response.data.states || [];

    } catch (error) {
        console.warn("OpenSky API fetch failed (likely CORS or Rate Limit or Proxy Error).");
        return [];
    }
};

// Convert Lat/Lon/Alt to Local Sky Coordinates (Az/El/Range) relative to Observer
export const getPlanePositionRelative = (planeState, observerLat, observerLon, observerAlt = 0) => {
    // Plane: lon(5), lat(6), alt(7)
    const pLon = planeState[5];
    const pLat = planeState[6];
    const pAlt = planeState[7]; // meters

    if (pLon === null || pLat === null) return null;

    // Simple flat earth approximation or spherical calculation for Azimuth/Elevation
    // For local sky view (range < 300km), we can use Haversine for distance and bearing for azimuth.
    // Elevation is atan2(height_diff, distance).

    const R = 6371e3; // Earth radius meters

    const dLat = (pLat - observerLat) * Math.PI / 180;
    const dLon = (pLon - observerLon) * Math.PI / 180;

    const lat1 = observerLat * Math.PI / 180;
    const lat2 = pLat * Math.PI / 180;

    // Haversine distance on surface
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const surfaceDist = R * c; // meters

    // Calculate Azimuth (Bearing)
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let az = Math.atan2(y, x); // radians
    // normalize to 0-2PI? (atan2 is -PI to PI)
    // We can keep it as is, or normalize.
    // Usually Azimuth is 0 at North, clockwise.
    // Standard atan2 (x,y) -> 0 is +X (East).
    // Here we used standard bearing formula, where 0 is North if mapped correctly.
    // Let's verify mapping later.

    // Elevation
    // Height difference
    const altDiff = pAlt - observerAlt; // meters
    // Simple flat triangle approximation for elevation is okay for short ranges and visual only
    // Correct way: Earth curvature taking into account.
    // For AR app, visible planes are close enough.
    const el = Math.atan2(altDiff - (surfaceDist*surfaceDist)/(2*R), surfaceDist);
    // (Approximation subtracting drop due to curvature)

    return {
        azimuth: az,
        elevation: el,
        range: surfaceDist/1000, // km
        callsign: planeState[1]?.trim()
    };
}
