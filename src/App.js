import "./App.css";
import React from "react";
import Navbar from "./components/Navbar";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/pages/Home";
import Upload from "./components/pages/Upload";
import Camera from "./components/pages/Camera";
import MoodWheel from "./components/pages/MoodWheel";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="app-shell">
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/mood-wheel" element={<MoodWheel />} />
        </Routes>
        <Footer />
      </Router>
    </div>
  );
}

export default App;
