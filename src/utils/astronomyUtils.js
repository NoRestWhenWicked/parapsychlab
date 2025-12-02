// Convert RA (hours) and Dec (degrees) to Cartesian coordinates (x, y, z)
// based on Observer Location and Local Sidereal Time (LST).

export function getLocalSiderealTime(lon, date) {
    // Greenwhich Mean Sidereal Time (GMST)
    // Approximate calculation
    const d = (date.getTime() - new Date(Date.UTC(2000, 0, 1, 12, 0, 0)).getTime()) / 86400000;
    const gmst = 18.697374558 + 24.06570982441908 * d;

    // Normalize to 0-24
    const gmstNorm = gmst % 24;
    const gmstFinal = gmstNorm < 0 ? gmstNorm + 24 : gmstNorm;

    // Local Sidereal Time = GMST + Longitude (in hours)
    // Longitude is in degrees, convert to hours (divide by 15)
    const lst = gmstFinal + (lon / 15);

    // Normalize
    const lstNorm = lst % 24;
    return lstNorm < 0 ? lstNorm + 24 : lstNorm;
}

export function celestialToHorizontal(ra, dec, lat, lst) {
    // RA, LST in hours
    // Dec, Lat in degrees

    const raRad = ra * 15 * (Math.PI / 180);
    const decRad = dec * (Math.PI / 180);
    const latRad = lat * (Math.PI / 180);
    const lstRad = lst * 15 * (Math.PI / 180);

    // Hour Angle
    let haRad = lstRad - raRad;

    // Altitude (Elevation)
    // sin(Alt) = sin(Dec)*sin(Lat) + cos(Dec)*cos(Lat)*cos(HA)
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const altRad = Math.asin(sinAlt);

    // Azimuth
    // cos(Az) = (sin(Dec) - sin(Alt)*sin(Lat)) / (cos(Alt)*cos(Lat))
    // This gives Azimuth from North, usually measured Westward? Or standard?
    // Formula typically gives Azimuth from South? Or North?
    // Let's use a standard atan2 approach for better quadrant handling.
    // tan(Az) = sin(HA) / (cos(HA)*sin(Lat) - tan(Dec)*cos(Lat))
    // Denom: cos(HA)*sin(Lat) - tan(Dec)*cos(Lat)

    const y = Math.sin(haRad);
    const x = Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad);

    const azRad = Math.atan2(y, x);
    // This azimuth is usually from South, Westward positive.
    // Convert to North, Eastward positive for typical compass.
    // Azimuth = (Azimuth + PI) ?
    // Standard Astronomy: Azimuth 0 is North, 90 East.
    // The formula above: Az = 0 when HA = 0? No.

    // Let's stick to simple:
    // Azimuth from North (0) towards East (90).
    const azFromSouth = Math.atan2(Math.sin(haRad), Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad));

    // Adjust to North-based (0=N, 90=E)
    // The atan2 result is effectively 'Azimuth from South, clockwise is negative?'
    // Let's rely on testing or standard library if exact precision needed.
    // For now: Add PI to shift from South to North.
    const az = azFromSouth + Math.PI;

    return {
        azimuth: az, // Radians 0 to 2PI
        elevation: altRad // Radians
    };
}

export function celestialToCartesian(ra, dec, lat, lon, date, radius = 100) {
    const lst = getLocalSiderealTime(lon, date);
    const { azimuth, elevation } = celestialToHorizontal(ra, dec, lat, lst);

    // Assuming standard 3D: Y is up (Elevation), Z is North (or -Z), X is East.
    // polarToCartesian in satelliteUtils:
    // x = r * cos(el) * sin(az)
    // y = r * sin(el)
    // z = -r * cos(el) * cos(az)

    const x = radius * Math.cos(elevation) * Math.sin(azimuth);
    const y = radius * Math.sin(elevation);
    const z = -radius * Math.cos(elevation) * Math.cos(azimuth);

    return { x, y, z };
}

// Calculate Sun Position in ECI (Earth-Centered Inertial) coordinates (km)
export function getSunPositionECI(date) {
    // Approximate algorithm (AA 209)
    // Convert date to Julian Date
    const JD = (date.getTime() / 86400000.0) + 2440587.5;
    const D = JD - 2451545.0;

    // Mean anomaly of the Sun
    const g = 357.529 + 0.98560028 * D;
    const gRad = g * (Math.PI / 180);

    // Mean longitude of the Sun
    const q = 280.459 + 0.98564736 * D;
    const qRad = q * (Math.PI / 180);

    // Ecliptic longitude
    const L = q + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad);
    const LRad = L * (Math.PI / 180);

    // Obliquity of the ecliptic
    const e = 23.439 - 0.00000036 * D;
    const eRad = e * (Math.PI / 180);

    // Distance (AU)
    const R = 1.00014 - 0.01671 * Math.cos(gRad) - 0.00014 * Math.cos(2 * gRad);
    const R_km = R * 149597870.7; // AU to km

    // Rectangular coordinates in Ecliptic
    // x = R * cos(L)
    // y = R * sin(L)
    // z = 0

    // Rotate to Equatorial (ECI)
    // X = x
    // Y = y * cos(e) - z * sin(e)
    // Z = y * sin(e) + z * cos(e)

    const x = R_km * Math.cos(LRad);
    const y = R_km * Math.sin(LRad) * Math.cos(eRad);
    const z = R_km * Math.sin(LRad) * Math.sin(eRad);

    return { x, y, z };
}

// Check if Satellite (at satPos ECI) is illuminated by Sun (at sunPos ECI)
// Uses cylindrical shadow model (simple approximation)
export function isSunlit(satPos, sunPos) {
    // Vectors
    // P_sat, P_sun

    // Vector from Sat to Sun is not what we check. We check Earth shadow.
    // Shadow axis is -P_sun (from Earth away from Sun).

    // U = Unit vector from Earth to Sun = sunPos normalized.
    // P = Vector to Satellite = satPos.

    // Projection of P onto U: d = P . U
    // This is distance along the Sun axis.
    // If d > 0, satellite is on the day side (mostly).
    // Actually, simple check:

    // Angle between P_sat and P_sun?
    // No, standard way:
    // Determine the distance of the satellite from the line connecting Earth and Sun center.
    // But we usually want shadow cone.

    // Simple Cylindrical Shadow:
    // 1. Project SatPos onto Sun-Earth axis.
    // Axis vector S = sunPos.
    // Projection length L = (SatPos . S) / |S|.
    // If L > 0 (Satellite is towards Sun), it is lit. (Earth is at 0,0,0).
    // If L < 0 (Satellite is behind Earth), check distance from axis.

    // Radius of shadow cylinder = Earth Radius = 6371 km.
    // Distance from axis: D = sqrt( |SatPos|^2 - L^2 ).
    // If D < EarthRadius and L < 0, then in shadow.

    // BUT: Earth radius is 6371.
    // Sun is much larger, so shadow is conical (Umbra/Penumbra).
    // For satellites (LEO/GEO), cylindrical is "okay" but conical is better.
    // However, cylindrical often underestimates visibility (shows eclipse when actually penumbra).
    // Given the request for "Visible", let's be strict. If it's in shadow, it's not visible.

    const Re = 6371; // km

    // Dot product P . S
    const dot = satPos.x * sunPos.x + satPos.y * sunPos.y + satPos.z * sunPos.z;
    const sunDistSq = sunPos.x*sunPos.x + sunPos.y*sunPos.y + sunPos.z*sunPos.z;
    const sunDist = Math.sqrt(sunDistSq);

    // Projection length along Sun vector (from Earth center towards Sun)
    const L = dot / sunDist;

    if (L >= 0) {
        // Satellite is on the "day side" of the plane perpendicular to sun vector.
        // It could still be in shadow if it's "behind" Earth but L is actually projection...
        // Wait, if Earth is (0,0,0). Sun is at (Sx, Sy, Sz).
        // Plane through Earth perpendicular to Sun line separates "front" and "back".
        // Satellites with L > 0 are definitely lit (unless Earth radius > sat radius... wait).
        // If L > 0, it means the angle between Sat and Sun is < 90 deg. Earth cannot block it.
        return true;
    }

    // If L < 0, it is on the night side.
    // Check distance from axis.
    // |SatPos|^2 = L^2 + D^2
    const satDistSq = satPos.x*satPos.x + satPos.y*satPos.y + satPos.z*satPos.z;
    const distFromAxisSq = satDistSq - L*L;

    // If distance from axis < Earth Radius, it is in shadow (Cylindrical model).
    if (distFromAxisSq < Re * Re) {
        return false; // In Shadow
    }

    return true; // Lit
}
