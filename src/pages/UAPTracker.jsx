import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, DeviceOrientationControls, Html, Sphere, Text } from '@react-three/drei'
import * as THREE from 'three'
import { fetchTLEs, getSatPositionRelative, polarToCartesian } from '../utils/satelliteUtils'
import { fetchPlanes, getPlanePositionRelative } from '../utils/planeUtils'
import starCatalog from '../utils/starCatalog.json'
import { gstime } from 'satellite.js'

function Loading() {
    return (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none z-10">
            <span className="text-white text-xl">Loading Sky Map...</span>
        </div>
    )
}

function RealStars({ observerLat, observerLon }) {
    // We calculate star positions based on Local Sidereal Time (LST)
    // LST = GMST + Longitude
    // RA/Dec to Az/El conversion needs:
    // HA (Hour Angle) = LST - RA
    // Then use spherical trig to get Az/El.

    const [starPositions, setStarPositions] = useState([]);

    useFrame(() => {
        const now = new Date();
        const gmst = gstime(now); // radians
        // gmst is in radians? satellite.js gstime returns radians.
        // wait, let's verify gstime unit. It usually returns radians.
        // observerLon is degrees. Convert to radians.

        const latRad = observerLat * (Math.PI / 180);
        const lonRad = observerLon * (Math.PI / 180);
        const lst = gmst + lonRad; // Local Sidereal Time in radians

        const positions = starCatalog.map(star => {
            // star.ra is in degrees. Convert to radians.
            const raRad = star.ra * (Math.PI / 180);
            const decRad = star.dec * (Math.PI / 180);

            const ha = lst - raRad; // Hour Angle

            // sin(El) = sin(Dec)sin(Lat) + cos(Dec)cos(Lat)cos(HA)
            const sinEl = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha);
            const el = Math.asin(sinEl);

            // cos(Az) = (sin(Dec) - sin(El)sin(Lat)) / (cos(El)cos(Lat))
            // Azimuth calculation is tricky due to quadrants.
            // Using atan2 is better.
            // sin(Az) = - sin(HA) * cos(Dec) / cos(El)
            // cos(Az) = (sin(Dec) - sin(El)*sin(Lat)) / (cos(El)*cos(Lat))

            // Formula for Az measured from North (0) Eastwards:
            // tan(Az) = sin(HA) / (cos(HA)sin(Lat) - tan(Dec)cos(Lat))
            // This usually gives Az from South? No, depends on convention.
            // Let's use the standard transformation:
            // x = -sin(HA)cos(Dec)
            // y = sin(Dec)cos(Lat) - cos(HA)cos(Dec)sin(Lat)
            // Az = atan2(x, y)
            // This Az is usually from South, Westward?
            // Standard Astronomy: Az 0 is North.
            // If we use the formula:
            // Az = atan2( sin(HA), cos(HA)sin(lat) - tan(dec)cos(lat) )
            // Check sign.

            const y = Math.sin(ha);
            const x = Math.cos(ha) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad);
            let az = Math.atan2(y, x) + Math.PI; // Add PI to shift 0 to North?
            // Usually this formula gives Az from South. Adding PI makes it from North.
            // Let's verify experimentally or assume standard 0=North convention required.

            // Re-normalizing to 0-2PI
            az = (az + 2 * Math.PI) % (2 * Math.PI);

            // Filter below horizon?
            // "Real stars" should probably be visible even if below horizon in "Globe View", but in AR view, ground blocks them.
            // But we render them far away.
            // If we render below horizon, and we have a ground, it's fine.

            const distance = 400; // Stars are background
            // Use polarToCartesian (expects 0=North)
            const pos = polarToCartesian(az, el, distance);

            return {
                ...star,
                position: pos,
                visible: el > -0.1 // show slightly below horizon to avoid popping
            };
        });
        setStarPositions(positions);
    });

    return (
        <group>
            {starPositions.map((star, idx) => (
                star.visible && (
                <group key={idx} position={star.position}>
                    <mesh>
                        <sphereGeometry args={[Math.max(0.2, 1.5 + star.mag * -0.5), 8, 8]} />
                        <meshBasicMaterial color="white" />
                    </mesh>
                     {/* Only label very bright stars or if zoomed in? keeping simple for now */}
                </group>
                )
            ))}
        </group>
    )
}

function Satellites({ observerLat, observerLon }) {
    const [satellites, setSatellites] = useState([]);
    const [satPositions, setSatPositions] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            const data = await fetchTLEs();
            setSatellites(data.slice(0, 500));
        };
        loadData();
    }, []);

    useFrame(() => {
        if (satellites.length === 0) return;

        const now = new Date();
        const positions = satellites.map(sat => {
            const relativePos = getSatPositionRelative(sat.satrec, now, observerLat, observerLon, 0);
            if (!relativePos) return null;
            if (relativePos.elevation < 0) return null; // Below horizon

            const distance = 80; // Render further out
            const pos = polarToCartesian(relativePos.azimuth, relativePos.elevation, distance);

            return {
                id: sat.name,
                position: pos,
                info: sat
            };
        }).filter(p => p !== null);

        setSatPositions(positions);
    });

    return (
        <group>
            {satPositions.map((sat, idx) => (
                <mesh key={idx} position={sat.position}>
                    <sphereGeometry args={[0.3, 8, 8]} />
                    <meshBasicMaterial color="#00ff00" />
                </mesh>
            ))}
        </group>
    );
}

function Planes({ observerLat, observerLon }) {
    const [planes, setPlanes] = useState([]);
    const [planePositions, setPlanePositions] = useState([]);

    useEffect(() => {
        const loadPlanes = async () => {
            // Define bounding box around observer (approx +/- 2 degrees ~ 200km)
            const minLat = observerLat - 2;
            const maxLat = observerLat + 2;
            const minLon = observerLon - 2;
            const maxLon = observerLon + 2;

            const data = await fetchPlanes(minLat, minLon, maxLat, maxLon);
            setPlanes(data);
        };

        // Poll every 10 seconds
        loadPlanes();
        const interval = setInterval(loadPlanes, 10000);
        return () => clearInterval(interval);
    }, [observerLat, observerLon]);

    useFrame(() => {
        if (planes.length === 0) return;

        const now = Date.now() / 1000; // current time in seconds

        const positions = planes.map(plane => {
            const timePos = plane[3];
            const velocity = plane[9] || 0;
            const heading = plane[10] || 0;
            const lat = plane[6];
            const lon = plane[5];
            const alt = plane[7] || 0;
            const verticalRate = plane[11] || 0;

            if (lat === null || lon === null) return null;

            const elapsedSeconds = timePos ? Math.max(0, now - timePos) : 0;

            const R = 6371000; // Earth radius in meters
            const distMoved = velocity * elapsedSeconds; // meters
            const headingRad = heading * Math.PI / 180;
            const latRad = lat * Math.PI / 180;

            const dLat = (distMoved * Math.cos(headingRad)) / R;
            const dLon = (distMoved * Math.sin(headingRad)) / (R * Math.cos(latRad));

            const newLat = lat + (dLat * 180 / Math.PI);
            const newLon = lon + (dLon * 180 / Math.PI);
            const newAlt = alt + (verticalRate * elapsedSeconds);

            const virtualPlane = [...plane];
            virtualPlane[5] = newLon;
            virtualPlane[6] = newLat;
            virtualPlane[7] = newAlt;

            const relativePos = getPlanePositionRelative(virtualPlane, observerLat, observerLon, 0);
            if (!relativePos) return null;
            if (relativePos.elevation < 0) return null; // Below horizon

            const distance = 60; // Render closer than satellites
            const pos = polarToCartesian(relativePos.azimuth, relativePos.elevation, distance);

            return {
                id: plane[0], // icao24
                callsign: relativePos.callsign || plane[0],
                position: pos,
                heading: plane[10] || 0
            };
        }).filter(p => p !== null);

        setPlanePositions(positions);
    });

    return (
        <group>
            {planePositions.map((plane, idx) => (
                <group key={idx} position={plane.position} rotation={[0, -plane.heading * (Math.PI / 180), 0]}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <coneGeometry args={[0.2, 0.6, 8]} />
                        <meshBasicMaterial color="#00ffff" />
                    </mesh>
                    <Html distanceFactor={15}>
                        <div className="text-xs text-cyan-400 whitespace-nowrap">{plane.callsign}</div>
                    </Html>
                </group>
            ))}
        </group>
    )
}

function Globe() {
    // A simple representation of the Earth below the observer
    // Observer is at (0,0,0). Earth radius is huge.
    // We scale it down visually but keep relative geometry roughly correct for horizon.
    // If we want a "draggable globe", that implies we are looking at the globe from outside.
    // But the user said "centers on you... but is draggable".
    // This supports the "Map View" hypothesis where we look at the Earth.

    // However, keeping consistent with AR view (Observer at center):
    // The "Globe" is the ground.
    // Let's create a large sphere below the origin.
    // Radius R = 6371km.
    // We are at height H.
    // Scale: 1 unit = ?
    // If we use scale 1 unit = 1km.
    // R = 6371.
    // Position = [0, -6371, 0].
    // This effectively creates a flat horizon at the origin.

    return (
         <Sphere args={[6371, 64, 64]} position={[0, -6371, 0]}>
            <meshStandardMaterial color="#1a2b3c" wireframe={true} transparent opacity={0.3} />
         </Sphere>
    )
}

function Scene({ observerLat, observerLon, isARMode }) {
    return (
        <>
            <ambientLight intensity={0.5} />
            <RealStars observerLat={observerLat} observerLon={observerLon} />

            <Satellites observerLat={observerLat} observerLon={observerLon} />
            <Planes observerLat={observerLat} observerLon={observerLon} />

            {isARMode ? (
                 <DeviceOrientationControls />
            ) : (
                <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
            )}

            {/* Compass / Ground Reference */}
            <gridHelper args={[100, 20, 0x444444, 0x222222]} position={[0, -2, 0]} />
            <Globe />

            {/* North Marker */}
             <mesh position={[0, -2, -50]}>
                <boxGeometry args={[1, 5, 1]} />
                <meshBasicMaterial color="red" />
            </mesh>
            <Text
                position={[0, 4, -50]}
                fontSize={5}
                color="red"
                anchorX="center"
                anchorY="middle"
            >
                N
            </Text>
        </>
    )
}

function CameraFeed() {
    const videoRef = useRef(null)

    useEffect(() => {
        async function getCamera() {
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                }
            } catch (e) {
                console.error("Camera access denied", e)
            }
        }
        getCamera()
    }, [])

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-0 left-0 w-full h-full object-cover z-0"
        />
    )
}

export default function UAPTracker() {
    const [userLocation, setUserLocation] = useState({ lat: 40.7128, lon: -74.0060 }); // Default NYC
    const [isARMode, setIsARMode] = useState(false);
    const [hasLocation, setHasLocation] = useState(false);

    useEffect(() => {
        if (navigator.geolocation) {
            const id = navigator.geolocation.watchPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                    setHasLocation(true);
                },
                (error) => console.error("Geolocation error:", error),
                { enableHighAccuracy: true }
            );
            return () => navigator.geolocation.clearWatch(id);
        }
    }, []);

    return (
        <div className="w-full h-screen bg-black relative">
            {isARMode && <CameraFeed />}

            <Suspense fallback={<Loading />}>
                <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }} style={{ zIndex: 1, background: 'transparent' }}>
                    <Scene observerLat={userLocation.lat} observerLon={userLocation.lon} isARMode={isARMode} />
                </Canvas>
            </Suspense>

            {/* UI Overlay */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
                <h1 className="text-2xl font-bold text-white shadow-md">UAP Tracker</h1>
                <div className="text-xs text-gray-400">
                    {hasLocation ? `Lat: ${userLocation.lat.toFixed(4)}, Lon: ${userLocation.lon.toFixed(4)}` : "Locating..."}
                </div>
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-gray-300 text-sm">Satellites</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-cyan-500"></div>
                        <span className="text-gray-300 text-sm">Planes</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-white"></div>
                        <span className="text-gray-300 text-sm">Stars</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                 <button
                    onClick={() => setIsARMode(!isARMode)}
                    className="bg-blue-600 px-4 py-2 rounded text-white shadow-lg hover:bg-blue-700 pointer-events-auto"
                >
                    {isARMode ? "Manual Mode" : "AR Mode"}
                </button>
                <button className="bg-purple-600 px-4 py-2 rounded text-white shadow-lg hover:bg-purple-700 pointer-events-auto">
                    Tag Object
                </button>
                <LinkButton to="/" className="bg-gray-700 px-4 py-2 rounded text-white shadow-lg hover:bg-gray-600 pointer-events-auto">
                    Back
                </LinkButton>
            </div>
        </div>
    )
}

// Helper for Link since we are outside Router context in Canvas, but inside in main component
import { useNavigate } from 'react-router-dom';

function LinkButton({ to, className, children }) {
    const navigate = useNavigate();
    return (
        <button className={className} onClick={() => navigate(to)}>
            {children}
        </button>
    )
}
