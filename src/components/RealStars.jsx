import React, { useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
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
        }).filter(star => star.position[1] > 0); // Filter stars below horizon (y < 0)
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
                        <Billboard>
                            <Text
                                position={[0, -2, 0]}
                                fontSize={2}
                                color="rgba(255,255,255,0.7)"
                                anchorX="center"
                                anchorY="top"
                            >
                                {star.name}
                            </Text>
                        </Billboard>
                    )}
                </group>
            ))}
        </group>
    );
}
