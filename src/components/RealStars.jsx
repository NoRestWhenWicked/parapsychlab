import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import starData from '../data/stars.json';
import { celestialToCartesian } from '../utils/astronomyUtils';

export default function RealStars({ observerLat, observerLon, showLabels }) {
    const stars = useMemo(() => {
        const now = new Date();
        const radius = 200; // Place stars further out
        return starData.map(star => {
            const pos = celestialToCartesian(star.ra, star.dec, observerLat, observerLon, now, radius);
            return {
                ...star,
                position: [pos.x, pos.y, pos.z]
            };
        });
    }, [observerLat, observerLon]);

    return (
        <group>
            {stars.map((star, idx) => (
                <group key={idx} position={star.position}>
                    <mesh>
                        <sphereGeometry args={[0.5, 8, 8]} />
                        <meshBasicMaterial color="white" />
                    </mesh>
                    {showLabels && (
                        <Text
                            position={[0, -2, 0]}
                            fontSize={2}
                            color="rgba(255,255,255,0.7)"
                            anchorX="center"
                            anchorY="top"
                        >
                            {star.name}
                        </Text>
                    )}
                </group>
            ))}
        </group>
    );
}
