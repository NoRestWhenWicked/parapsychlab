import React from "react";

export default function App() {
  return (
    <div className="bg-black text-white min-h-screen font-sans">
      <section className="flex flex-col items-center justify-center text-center h-screen px-6">
        <div className="animate-pulse-slow">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Welcome to ParaPsychLab
          </h1>
          <p className="mt-4 text-xl md:text-2xl text-gray-300">
            Mapping Consciousness. Training Perception. Proving the Impossible.
          </p>
          <button className="mt-8 px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 transition-all">
            Enter the Lab
          </button>
        </div>
      </section>
    </div>
  );
}
