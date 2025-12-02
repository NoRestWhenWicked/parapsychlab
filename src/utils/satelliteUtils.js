import axios from 'axios';
import { twoline2satrec, propagate, gstime, eciToGeodetic, radiansToDegrees, eciToEcf, ecfToLookAngles } from 'satellite.js';
import { isSunlit } from './astronomyUtils';

// TLE Data Source (Celestrak)
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';

export const fetchTLEs = async () => {
    try {
        const response = await axios.get(TLE_URL);
        const data = response.data;
        const lines = data.split('\n');
        const satellites = [];

        for (let i = 0; i < lines.length; i += 3) {
            if (lines[i] && lines[i+1] && lines[i+2]) {
                const name = lines[i].trim();
                const line1 = lines[i+1].trim();
                const line2 = lines[i+2].trim();

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

export const getSatellitePosition = (satrec, date) => {
    const positionAndVelocity = propagate(satrec, date);
    const positionEci = positionAndVelocity.position;
    if (!positionEci) return null;
    return {
        x: positionEci.x,
        y: positionEci.y,
        z: positionEci.z
    };
};

// Check if satellite is visible (Sunlit AND Above Horizon)
// Note: `relativePos` has Elevation.
// We also need ECI position for Shadow check.
export const isSatVisible = (satrec, date, relativePos, sunPos) => {
    // 1. Check Horizon
    if (relativePos.elevation < 0) return false;

    // 2. Check Shadow
    // Get ECI
    const pos = getSatellitePosition(satrec, date);
    if (!pos) return false;

    return isSunlit(pos, sunPos);
};

export const getSatPositionRelative = (satrec, date, observerLat, observerLon, observerAlt) => {
    const positionAndVelocity = propagate(satrec, date);
    const positionEci = positionAndVelocity.position;

    if (!positionEci) return null;

    const gmst = gstime(date);

    const observerGd = {
        latitude: observerLat * (Math.PI / 180),
        longitude: observerLon * (Math.PI / 180),
        height: observerAlt
    };

    const positionEcf = eciToEcf(positionEci, gmst);
    const lookAngles = ecfToLookAngles(observerGd, positionEcf);

    return {
        azimuth: lookAngles.azimuth,
        elevation: lookAngles.elevation,
        range: lookAngles.rangeSat
    };
};

export const polarToCartesian = (azimuth, elevation, distance) => {
    const x = distance * Math.cos(elevation) * Math.sin(azimuth);
    const y = distance * Math.sin(elevation);
    const z = -distance * Math.cos(elevation) * Math.cos(azimuth);
    return [x, y, z];
}
