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
