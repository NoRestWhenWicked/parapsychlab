import React, { Suspense, useEffect, useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, OrbitControls, Text, DeviceOrientationControls } from '@react-three/drei'
import * as THREE from 'three'
import { fetchTLEs, getSatPositionRelative, polarToCartesian, isSatVisible } from '../utils/satelliteUtils'
import { fetchPlanes, getPlanePositionRelative } from '../utils/planeUtils'
import { getSunPositionECI } from '../utils/astronomyUtils'
import RealStars from '../components/RealStars'
import AROverlay from '../components/AROverlay'
import { useNavigate } from 'react-router-dom'

function Loading() {
    return (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none z-10">
            <span className="text-white text-xl">Loading Sky Map...</span>
        </div>
    )
}

function Satellites({ observerLat, observerLon, showLabels, azimuthOffset, filterVisible }) {
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
        const offsetRad = azimuthOffset * (Math.PI / 180);
        const sunPos = getSunPositionECI(now);

        const positions = satellites.map(sat => {
            const relativePos = getSatPositionRelative(sat.satrec, now, observerLat, observerLon, 0);
            if (!relativePos) return null;
            if (relativePos.elevation < 0) return null; // Below horizon

            // Visibility Filter
            if (filterVisible) {
                const visible = isSatVisible(sat.satrec, now, relativePos, sunPos);
                if (!visible) return null;
            }

            const distance = 150; // Between Planes and Stars
            // Apply azimuth offset
            const correctedAzimuth = relativePos.azimuth + offsetRad;
            const pos = polarToCartesian(correctedAzimuth, relativePos.elevation, distance);

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
                <group key={idx} position={sat.position}>
                    <mesh>
                        <sphereGeometry args={[0.4, 8, 8]} />
                        <meshBasicMaterial color="#00ff00" />
                    </mesh>
                    {showLabels && (
                         <Text
                            position={[0, -1, 0]}
                            fontSize={1.5}
                            color="#00ff00"
                            anchorX="center"
                            anchorY="top"
                        >
                            {sat.id}
                        </Text>
                    )}
                </group>
            ))}
        </group>
    );
}

function Planes({ observerLat, observerLon, showLabels, azimuthOffset }) {
    const [planes, setPlanes] = useState([]);
    const [planePositions, setPlanePositions] = useState([]);

    useEffect(() => {
        const loadPlanes = async () => {
            const minLat = observerLat - 2;
            const maxLat = observerLat + 2;
            const minLon = observerLon - 2;
            const maxLon = observerLon + 2;

            const data = await fetchPlanes(minLat, minLon, maxLat, maxLon);
            setPlanes(data);
        };

        loadPlanes();
        const interval = setInterval(loadPlanes, 10000);
        return () => clearInterval(interval);
    }, [observerLat, observerLon]);

    useFrame(() => {
        if (planes.length === 0) return;

        const offsetRad = azimuthOffset * (Math.PI / 180);

        const positions = planes.map(plane => {
            const relativePos = getPlanePositionRelative(plane, observerLat, observerLon, 0);
            if (!relativePos) return null;
            if (relativePos.elevation < 0) return null;

            const distance = 80;
            const correctedAzimuth = relativePos.azimuth + offsetRad;
            const pos = polarToCartesian(correctedAzimuth, relativePos.elevation, distance);

            return {
                id: plane[0],
                callsign: relativePos.callsign || plane[0],
                position: pos
            };
        }).filter(p => p !== null);

        setPlanePositions(positions);
    });

    return (
        <group>
            {planePositions.map((plane, idx) => (
                <group key={idx} position={plane.position}>
                    <mesh>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshBasicMaterial color="#00ffff" />
                    </mesh>
                    {showLabels && (
                        <Text
                            position={[0, -1.5, 0]}
                            fontSize={2}
                            color="#00ffff"
                            anchorX="center"
                            anchorY="top"
                        >
                            {plane.callsign}
                        </Text>
                    )}
                </group>
            ))}
        </group>
    )
}

function SkyGroup({ children, azimuthOffset }) {
    const groupRef = useRef();
    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y = -azimuthOffset * (Math.PI / 180);
        }
    });
    return <group ref={groupRef}>{children}</group>;
}

function Scene({ arMode, showLabels, observerLat, observerLon, azimuthOffset, filterVisible }) {
    return (
        <>
            <ambientLight intensity={0.5} />

            <SkyGroup azimuthOffset={azimuthOffset}>
                <RealStars observerLat={observerLat} observerLon={observerLon} showLabels={showLabels} />
                <Satellites
                    observerLat={observerLat}
                    observerLon={observerLon}
                    showLabels={showLabels}
                    azimuthOffset={0}
                    filterVisible={filterVisible}
                />
                <Planes observerLat={observerLat} observerLon={observerLon} showLabels={showLabels} azimuthOffset={0} />

                {/* North Marker */}
                <mesh position={[0, -10, -50]}>
                    <boxGeometry args={[1, 5, 1]} />
                    <meshBasicMaterial color="red" />
                </mesh>
                <Text
                    position={[0, -2, -50]}
                    fontSize={5}
                    color="red"
                    anchorX="center"
                    anchorY="middle"
                >
                    N
                </Text>

                 {/* Compass / Ground Reference */}
                {!arMode && <gridHelper args={[100, 20, 0x444444, 0x222222]} position={[0, -10, 0]} />}
            </SkyGroup>

            {/* Controls */}
            {arMode ? (
                <DeviceOrientationControls />
            ) : (
                <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
            )}
        </>
    )
}

export default function UAPTracker() {
    const [arMode, setArMode] = useState(false);
    const [showLabels, setShowLabels] = useState(true);
    const [observerPos, setObserverPos] = useState(null);
    const [fov, setFov] = useState(75);
    const [azimuthOffset, setAzimuthOffset] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (navigator.geolocation) {
            const id = navigator.geolocation.watchPosition(
                (position) => {
                    setObserverPos({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                },
                (err) => console.error(err),
                { enableHighAccuracy: true }
            );
            return () => navigator.geolocation.clearWatch(id);
        } else {
            alert("Geolocation is not supported by this browser.");
            // Fallback to NYC
             setObserverPos({ lat: 40.7128, lon: -74.0060 });
        }
    }, []);

    const requestPermissions = async () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    setArMode(true);
                } else {
                    alert("Permission denied for device orientation");
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            setArMode(true);
        }
    };

    const toggleAR = () => {
        if (!arMode) {
            requestPermissions();
        } else {
            setArMode(false);
        }
    };

    if (!observerPos) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center">
                <h1 className="text-white text-2xl">Acquiring GPS Signal...</h1>
            </div>
        )
    }

    return (
        <div className="w-full h-screen bg-black relative overflow-hidden">
            {/* Video Background for AR */}
            <AROverlay active={arMode} />

            <Suspense fallback={<Loading />}>
                <Canvas
                    camera={{ position: [0, 0, 0.1], fov: fov }}
                    gl={{ alpha: true, antialias: true }}
                    style={{ background: arMode ? 'transparent' : 'black' }}
                >
                    <Scene
                        arMode={arMode}
                        showLabels={showLabels}
                        observerLat={observerPos.lat}
                        observerLon={observerPos.lon}
                        azimuthOffset={azimuthOffset}
                        filterVisible={filterVisible}
                    />
                </Canvas>
            </Suspense>

            {/* UI Overlay */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
                <h1 className="text-2xl font-bold text-white shadow-md">UAP Tracker {arMode ? 'AR' : '3D'}</h1>
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

            {/* Settings Button */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="px-4 py-2 rounded shadow-lg bg-gray-800 text-white text-sm font-bold"
                >
                    {showSettings ? 'Close Settings' : 'Settings'}
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="absolute top-16 right-4 z-20 bg-gray-900 bg-opacity-90 p-4 rounded text-white w-64">
                    <h3 className="font-bold mb-2">Calibration</h3>

                    <div className="mb-4">
                        <label className="block text-xs mb-1">Camera FOV ({fov}°)</label>
                        <input
                            type="range"
                            min="30"
                            max="120"
                            value={fov}
                            onChange={(e) => setFov(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs mb-1">Compass Offset ({azimuthOffset}°)</label>
                        <input
                            type="range"
                            min="-180"
                            max="180"
                            value={azimuthOffset}
                            onChange={(e) => setAzimuthOffset(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <h3 className="font-bold mb-2 mt-4">View Options</h3>
                     <button
                        onClick={() => setFilterVisible(!filterVisible)}
                        className={`w-full py-2 rounded mb-2 text-sm font-bold ${filterVisible ? 'bg-orange-500 text-white' : 'bg-gray-700'}`}
                    >
                        {filterVisible ? 'Show Only Visible (Sunlit)' : 'Show All Satellites'}
                    </button>

                    <button
                        onClick={() => setShowLabels(!showLabels)}
                        className={`w-full py-2 rounded mb-2 text-sm font-bold ${showLabels ? 'bg-blue-600' : 'bg-gray-700'}`}
                    >
                        {showLabels ? 'Labels ON' : 'Labels OFF'}
                    </button>

                    <button
                        onClick={toggleAR}
                        className={`w-full py-2 rounded text-sm font-bold ${arMode ? 'bg-red-600' : 'bg-green-600'}`}
                    >
                        {arMode ? 'Stop AR' : 'Start AR'}
                    </button>
                </div>
            )}

            <div className="absolute bottom-4 left-4 z-10">
                <button className="bg-purple-600 px-4 py-2 rounded text-white mr-2 shadow-lg hover:bg-purple-700">
                    Tag Object
                </button>
                <button className="bg-gray-700 px-4 py-2 rounded text-white shadow-lg hover:bg-gray-600" onClick={() => navigate('/')}>
                    Back
                </button>
            </div>
        </div>
    )
}
