import axios from 'axios';
import { twoline2satrec, propagate, gstime, eciToGeodetic, radiansToDegrees, eciToEcf, ecfToLookAngles } from 'satellite.js';

// TLE Data Source (Celestrak)
// Using a proxy or direct link if CORS allows. Celestrak usually allows CORS.
// Common sets: 'stations', 'starlink', 'gps-ops', etc.
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';

// Function to fetch TLE data
export const fetchTLEs = async () => {
    try {
        const response = await axios.get(TLE_URL);
        const data = response.data;
        const lines = data.split('\n');
        const satellites = [];

        // Parse TLE data (3 lines per satellite usually in raw text: Name, Line 1, Line 2)
        // But GP format often is 3 lines: 0 Name, 1 Line1, 2 Line2
        for (let i = 0; i < lines.length; i += 3) {
            if (lines[i] && lines[i+1] && lines[i+2]) {
                const name = lines[i].trim();
                const line1 = lines[i+1].trim();
                const line2 = lines[i+2].trim();

                // specific check if it looks like TLE
                if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
                    satellites.push({
                        name,
                        line1,
                        line2,
                        satrec: twoline2satrec(line1, line2)
                    });
                }
            }
        }
        return satellites;
    } catch (error) {
        console.error("Error fetching TLEs:", error);
        return [];
    }
};

// Function to calculate satellite position in ECI coordinates (Earth-Centered Inertial)
export const getSatellitePosition = (satrec, date) => {
    const positionAndVelocity = propagate(satrec, date);
    const positionEci = positionAndVelocity.position;
    // velocity is also available: positionAndVelocity.velocity

    if (!positionEci) return null;

    return {
        x: positionEci.x,
        y: positionEci.y,
        z: positionEci.z
    };
};

// Convert ECI to Game World Coordinates
// We need to scale down significantly. Earth radius is ~6371 km.
// Let's say 1 unit = 1000 km.
export const eciToWorld = (eci) => {
    const scale = 1 / 1000;
    return [eci.x * scale, eci.z * scale, -eci.y * scale]; // Swap Y/Z for typical 3D engine Y-up
};

// For AR, we need position relative to observer (Topocentric)
// This is more complex. We need Observer Lat/Lon/Alt.
// If we assume observer is at (0,0,0) of the world (center of earth?? No.)
// AR usually implies observer is on surface looking up.
// So we need to map ECI to Topocentric (Azimuth, Elevation, Range).
// Then map Az/El to 3D sphere coordinates.

export const getSatPositionRelative = (satrec, date, observerLat, observerLon, observerAlt) => {
    const positionAndVelocity = propagate(satrec, date);
    const positionEci = positionAndVelocity.position;

    if (!positionEci) return null;

    const gmst = gstime(date);

    // Set observer position (radians, km)
    // observerLat/Lon in degrees
    // observerAlt in km
    const observerGd = {
        latitude: observerLat * (Math.PI / 180),
        longitude: observerLon * (Math.PI / 180),
        height: observerAlt
    };

    // Coordinate transform from ECI to Geodetic is not needed for look angles directly from library usually?
    // satellite.js has eciToGeodetic, but we want relative look angles.
    // wait, satellite.js has `ecfToLookAngles`? No, let's check docs or usage.
    // Usually: ECI -> ECF -> Look Angles.

    // ECI to ECF
    const positionEcf = eciToEcf(positionEci, gmst);

    // ECF to Look Angles (Azimuth, Elevation, Range)
    const lookAngles = ecfToLookAngles(observerGd, positionEcf);

    // lookAngles.azimuth, lookAngles.elevation (radians)
    // range usually in km

    return {
        azimuth: lookAngles.azimuth,
        elevation: lookAngles.elevation,
        range: lookAngles.rangeSat
    };
};

export const polarToCartesian = (azimuth, elevation, distance) => {
    // Convert Az/El (radians) to Cartesian (x,y,z)
    // Azimuth: from North (0) clockwise.
    // Elevation: from horizon (0) up (PI/2).

    // Standard Math:
    // y is up (Elevation)
    // x/z plane is ground.

    // x = r * cos(el) * sin(az)
    // y = r * sin(el)
    // z = -r * cos(el) * cos(az)  (Coordinate system verified: -Z is North)

    // Standard Three.js: Y up. -Z is forward (North).
    // Azimuth 0 is North (-Z), 90 is East (+X).
    // x = r * cos(el) * sin(az)
    // z = -r * cos(el) * cos(az)
    // y = r * sin(el)

    const x = distance * Math.cos(elevation) * Math.sin(azimuth);
    const y = distance * Math.sin(elevation);
    const z = -distance * Math.cos(elevation) * Math.cos(azimuth);

    return [x, y, z];
}
