import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, OrbitControls, Text, DeviceOrientationControls, useVideoTexture, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { fetchTLEs, getSatPositionRelative, polarToCartesian } from '../utils/satelliteUtils'
import { fetchPlanes, getPlanePositionRelative } from '../utils/planeUtils'

// --- AR / Video Background Component ---
function VideoBackground() {
    const { camera, scene } = useThree();
    const [stream, setStream] = useState(null);
    const videoRef = useRef(document.createElement("video"));

    useEffect(() => {
        let active = true;
        async function setupCamera() {
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                if (!active) return;
                setStream(s);
                videoRef.current.srcObject = s;
                videoRef.current.play();
            } catch (err) {
                console.error("Camera access denied:", err);
            }
        }
        setupCamera();
        return () => {
            active = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const texture = useVideoTexture(stream ? videoRef.current : null);

    // Calculate plane size to fill the frustum at a specific distance
    // We place it far back so objects appear in front
    const distance = 500;
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(vFOV / 2) * distance;
    const width = height * camera.aspect;

    if (!stream) return null;

    return (
        <mesh position={[0, 0, -distance]} parent={camera}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={texture} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
    );
}

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
            if (!observerLat || !observerLon) return;
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
        const now = Date.now() / 1000;

        const positions = planes.map(plane => {
            const timePos = plane[3];
            const velocity = plane[9] || 0;
            const heading = plane[10] || 0;
            const lat = plane[6];
            const lon = plane[5];
            const alt = plane[7] || 0;
            const verticalRate = plane[11] || 0;

            if (lat === null || lon === null) return null;

            // Calculate elapsed time since the data was recorded
            // If timePos is missing, we can't interpolate, so use 0.
            // We clamp elapsedSeconds to be >= 0 to handle potential clock skew where local time might be slightly behind server time.
            const elapsedSeconds = timePos ? Math.max(0, now - timePos) : 0;

            // Extrapolate position
            const R = 6371000; // Earth radius in meters
            const headingRad = heading * Math.PI / 180;
            const latRad = lat * Math.PI / 180;

            const distMoved = velocity * elapsedSeconds; // meters
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
            if (relativePos.elevation < 0) return null;

            const distance = 60;
            const pos = polarToCartesian(relativePos.azimuth, relativePos.elevation, distance);

            return {
                id: plane[0],
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

function Compass() {
    const radius = 20;
    const circles = [5, 10, 15, 20];

    return (
        <group position={[0, -10, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Concentric Circles */}
            {circles.map((r, i) => (
                <lineLoop key={i}>
                    <ringGeometry args={[r, r + 0.05, 64]} />
                    <meshBasicMaterial color="#444" side={THREE.DoubleSide} />
                </lineLoop>
            ))}

            {/* Crosshairs */}
            <mesh rotation={[0, 0, 0]}>
                <planeGeometry args={[0.1, radius * 2]} />
                <meshBasicMaterial color="#444" />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <planeGeometry args={[0.1, radius * 2]} />
                <meshBasicMaterial color="#444" />
            </mesh>

            {/* Cardinal Directions */}
            {/* North (-Z in 3D, which is Up in this rotated Plane) -> 0 rad is +X, PI/2 is +Y. */}
            {/* Actually, in 3D: North is -Z. East is +X. */}
            {/* We rotated -PI/2 on X. So +Y becomes -Z (North). +X stays +X (East). */}

            <Text position={[0, radius + 2, 0]} fontSize={2} color="red" rotation={[0, 0, 0]}>N</Text>
            <Text position={[0, -radius - 2, 0]} fontSize={2} color="white" rotation={[0, 0, Math.PI]}>S</Text>
            <Text position={[radius + 2, 0, 0]} fontSize={2} color="white" rotation={[0, 0, -Math.PI / 2]}>E</Text>
            <Text position={[-radius - 2, 0, 0]} fontSize={2} color="white" rotation={[0, 0, Math.PI / 2]}>W</Text>
        </group>
    );
}

function Scene({ isAR, observerLat, observerLon }) {
    return (
        <>
            <ambientLight intensity={0.5} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0} />

            <Satellites observerLat={observerLat} observerLon={observerLon} />
            <Planes observerLat={observerLat} observerLon={observerLon} />

            {/* Video Background if AR is on */}
            {isAR && <Suspense fallback={null}><VideoBackground /></Suspense>}

            {/* Controls */}
            {isAR ? <DeviceOrientationControls /> : <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />}

            {/* Ground Reference */}
            <Compass />
        </>
    )
}

function LinkButton({ to, className, children }) {
    const navigate = useNavigate();
    return (
        <button className={className} onClick={() => navigate(to)}>
            {children}
        </button>
    )
}

export default function UAPTracker() {
    // State
    const [isAR, setIsAR] = useState(false);
    const [recording, setRecording] = useState(false);
    const [observerLat, setObserverLat] = useState(40.7128); // Default NYC
    const [observerLon, setObserverLon] = useState(-74.0060);

    // Refs
    const canvasRef = useRef();
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    // Geolocation
    useEffect(() => {
        if (navigator.geolocation) {
            const id = navigator.geolocation.watchPosition(
                (pos) => {
                    setObserverLat(pos.coords.latitude);
                    setObserverLon(pos.coords.longitude);
                },
                (err) => console.warn(err),
                { enableHighAccuracy: true }
            );
            return () => navigator.geolocation.clearWatch(id);
        }
    }, []);

    // Recording Logic
    const startRecording = () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        const stream = canvas.captureStream(30); // 30 FPS
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `uap-recording-${new Date().toISOString()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
        };

        mediaRecorder.start();
        setRecording(true);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && recording) {
            mediaRecorderRef.current.stop();
            setRecording(false);
        }
    };

    return (
        <div className="w-full h-screen bg-black relative">
            <Suspense fallback={<Loading />}>
                <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }} ref={canvasRef} gl={{ preserveDrawingBuffer: true }}>
                    <Scene isAR={isAR} observerLat={observerLat} observerLon={observerLon} />
                </Canvas>
            </Suspense>

            {/* Top UI */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
                <h1 className="text-2xl font-bold text-white shadow-md">UAP Tracker AR</h1>
                <div className="text-xs text-gray-400 mt-1">
                    Loc: {observerLat.toFixed(4)}, {observerLon.toFixed(4)}
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
                </div>
            </div>

            {/* Controls UI */}
            <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                 <button
                    onClick={() => setIsAR(!isAR)}
                    className={`px-4 py-2 rounded text-white shadow-lg ${isAR ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                    {isAR ? "Disable AR" : "Enable AR"}
                </button>

                 <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`px-4 py-2 rounded text-white shadow-lg ${recording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {recording ? "Stop Rec" : "Record"}
                </button>

                <LinkButton to="/" className="bg-gray-700 px-4 py-2 rounded text-white shadow-lg hover:bg-gray-600">
                    Back
                </LinkButton>
            </div>

            {/* Recording Indicator */}
            {recording && (
                <div className="absolute top-4 right-4 z-10">
                    <div className="w-4 h-4 rounded-full bg-red-600 animate-ping"></div>
                </div>
            )}
        </div>
    )
}
