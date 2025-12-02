import React, { Suspense, useEffect, useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, OrbitControls, Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { fetchTLEs, getSatPositionRelative, polarToCartesian } from '../utils/satelliteUtils'
import { fetchPlanes, getPlanePositionRelative } from '../utils/planeUtils'

function Loading() {
    return (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none z-10">
            <span className="text-white text-xl">Loading Sky Map...</span>
        </div>
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
            // Adjust azimuth mapping if needed to match Three.js coordinate system
            // We assume standard mapping for now.
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

        // We assume planes move linearly between updates or just jump.
        // For smooth animation, we'd need to interpolate. For now, static snapshot per update.

        const positions = planes.map(plane => {
            const relativePos = getPlanePositionRelative(plane, observerLat, observerLon, 0);
            if (!relativePos) return null;
            if (relativePos.elevation < 0) return null; // Below horizon

            const distance = 60; // Render closer than satellites
            const pos = polarToCartesian(relativePos.azimuth, relativePos.elevation, distance);

            return {
                id: plane[0], // icao24
                callsign: relativePos.callsign || plane[0],
                position: pos
            };
        }).filter(p => p !== null);

        setPlanePositions(positions);
    });

    return (
        <group>
            {planePositions.map((plane, idx) => (
                <mesh key={idx} position={plane.position}>
                    {/* Plane represented as a cone or pyramid pointing up/forward? Just a box for now */}
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                    <meshBasicMaterial color="#00ffff" />
                    {/* <Html distanceFactor={15}>
                        <div className="text-xs text-cyan-400 whitespace-nowrap">{plane.callsign}</div>
                    </Html> */}
                </mesh>
            ))}
        </group>
    )
}

function Scene() {
    // Observer location (Mocked: NYC)
    const observerLat = 40.7128;
    const observerLon = -74.0060;

    return (
        <>
            <ambientLight intensity={0.5} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0} />

            <Satellites observerLat={observerLat} observerLon={observerLon} />
            <Planes observerLat={observerLat} observerLon={observerLon} />

            <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />

            {/* Compass / Ground Reference */}
            <gridHelper args={[100, 20, 0x444444, 0x222222]} position={[0, -10, 0]} />

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
        </>
    )
}

export default function UAPTracker() {
    return (
        <div className="w-full h-screen bg-black relative">
            <Suspense fallback={<Loading />}>
                <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }}>
                    <Scene />
                </Canvas>
            </Suspense>

            {/* UI Overlay */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
                <h1 className="text-2xl font-bold text-white shadow-md">UAP Tracker AR</h1>
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-gray-300 text-sm">Satellites</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-cyan-500"></div>
                        <span className="text-gray-300 text-sm">Planes</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 left-4 z-10">
                <button className="bg-purple-600 px-4 py-2 rounded text-white mr-2 shadow-lg hover:bg-purple-700">
                    Tag Object
                </button>
                <LinkButton to="/" className="bg-gray-700 px-4 py-2 rounded text-white shadow-lg hover:bg-gray-600">
                    Back
                </LinkButton>
            </div>
        </div>
    )
}

// Helper for Link since we are outside Router context in Canvas, but inside in main component
// Actually we are inside Router in App.jsx, so we can use useNavigate
import { useNavigate } from 'react-router-dom';

function LinkButton({ to, className, children }) {
    const navigate = useNavigate();
    return (
        <button className={className} onClick={() => navigate(to)}>
            {children}
        </button>
    )
}
