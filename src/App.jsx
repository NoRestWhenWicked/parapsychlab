import React from 'react'
import { motion } from 'framer-motion'

export default function App() {
    return (
        <div className="relative min-h-screen font-sans overflow-hidden bg-black text-white">
            {/* Animated fractal/particle backdrop */}
            <motion.div
                className="absolute inset-0 pointer-events-none z-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 3 }}
            >
                <div className="w-full h-full bg-gradient-to-b from-purple-900 via-black to-black opacity-90" />
                {/* Could add a subtle fractal swirl or starry field overlay here if desired */}
            </motion.div>

            {/* Hero Section */}
            <section className="relative flex flex-col items-center justify-center h-screen px-6 z-10">
                <motion.h1
                    className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                >
                    Welcome to ParaPsychLab
                </motion.h1>
                <motion.p
                    className="mt-4 text-xl md:text-2xl text-gray-300 max-w-2xl text-center"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 1.2, ease: 'easeOut' }}
                >
                    Mapping Consciousness. Training Perception. Proving the Impossible.
                </motion.p>

                <motion.button
                    className="mt-8 px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 transition-all shadow-lg"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1, duration: 1, ease: 'easeOut' }}
                >
                    Enter the Lab
                </motion.button>
            </section>

            {/* Floating Orbs/Particles Example */}
            <div className="pointer-events-none absolute inset-0 z-0">
                {[...Array(15)].map((_, i) => {
                    // generate random positions & durations
                    const randomX = Math.random() * 100
                    const randomY = Math.random() * 100
                    const randomSize = Math.random() * 40 + 10
                    const randomDelay = Math.random() * 2
                    const randomDuration = 5 + Math.random() * 5

                    return (
                        <motion.div
                            key={i}
                            className="absolute bg-purple-600 bg-opacity-30 rounded-full blur-xl"
                            style={{
                                width: `${randomSize}px`,
                                height: `${randomSize}px`,
                                top: `${randomY}%`,
                                left: `${randomX}%`,
                            }}
                            initial={{ y: -200, opacity: 0 }}
                            animate={{ y: 200, opacity: 1 }}
                            transition={{
                                delay: randomDelay,
                                repeat: Infinity,
                                repeatType: 'reverse',
                                duration: randomDuration,
                                ease: 'easeInOut',
                            }}
                        />
                    )
                })}
            </div>
        </div>
    )
}

