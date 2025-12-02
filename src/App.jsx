import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import UAPTracker from './pages/UAPTracker'

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/uap" element={<UAPTracker />} />
            </Routes>
        </Router>
    )
}
