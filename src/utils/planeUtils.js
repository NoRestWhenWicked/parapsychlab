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
    // 0 is North, increasing clockwise (90 East, 180 South, 270 West).
    // Verified to map correctly to 3D scene where -Z is North.
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let az = Math.atan2(y, x); // radians

    // Normalize to 0-2PI
    if (az < 0) {
        az += 2 * Math.PI;
    }

    // Elevation
    // Height difference
    // const altDiff = pAlt - observerAlt; // meters

    // Correct way: Earth curvature taking into account.
    const r_o = R + observerAlt;
    const r_t = R + pAlt;

    // Central angle in radians
    const theta = surfaceDist / R;

    // Slant range
    const s = Math.sqrt(r_o*r_o + r_t*r_t - 2*r_o*r_t*Math.cos(theta));

    let el;
    if (s === 0) {
        el = 0; // Observer and target are coincident
    } else {
        // sin(El) = (r_t * cos(theta) - r_o) / s
        // Derived from Law of Cosines on the Earth-Center/Observer/Target triangle
        const sinEl = (r_t * Math.cos(theta) - r_o) / s;
        // Clamp to valid range to avoid NaN from floating point errors
        el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
    }

    return {
        azimuth: az,
        elevation: el,
        range: surfaceDist/1000, // km
        callsign: planeState[1]?.trim()
    };
}
