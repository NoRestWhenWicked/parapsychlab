import React, { useEffect, useRef, useState } from 'react';

export default function AROverlay({ active }) {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (active) {
            const startCamera = async () => {
                try {
                    // Try the environment camera (rear) first
                    const constraints = {
                        video: { facingMode: { exact: "environment" } }
                    };
                    const s = await navigator.mediaDevices.getUserMedia(constraints).catch(() => {
                        // Fallback to any camera
                        return navigator.mediaDevices.getUserMedia({ video: true });
                    });

                    setStream(s);
                    if (videoRef.current) {
                        videoRef.current.srcObject = s;
                        videoRef.current.play();
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    setError("Camera access denied or unavailable.");
                }
            };
            startCamera();
        } else {
            // Stop stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [active]);

    if (!active) return null;

    return (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {error ? (
                <div className="flex items-center justify-center h-full bg-black text-red-500">
                    {error}
                </div>
            ) : (
                <video
                    ref={videoRef}
                    className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto object-cover transform -translate-x-1/2 -translate-y-1/2"
                    playsInline
                    muted
                />
            )}
        </div>
    );
}
