import React, { useState } from "react";
import "../../App.css";
import "./Camera.css";

import CameraComp from "../CameraComp.js";
import SongsList from "../SongsList.js";

function Camera() {
  const [mood, setMood] = useState("");

  return (
    <div className="camera-page">
      <video src="/videos/background.mp4" autoPlay loop muted className="dimmed-video" />
      <div className="camera-page__veil" aria-hidden="true" />

      <main className="camera-page__content">
        <section className="camera-page__intro">
          <p className="camera-page__eyebrow">Realtime Camera Intelligence</p>
          <h1>Understand Your Mood in Motion</h1>
          <p>
            Run continuous facial mood analysis with adaptive cadence, confidence gating,
            and one-tap playlist updates.
          </p>
        </section>

        <CameraComp setMood={setMood} />
      </main>

      <section className="camera-page__songs">
        <SongsList mood={mood} />
      </section>
    </div>
  );
}

export default Camera;
