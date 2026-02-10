import React, { useState } from "react";
import "../../App.css";
import "./MoodWheel.css";
import MoodWheelComp from "../MoodWheelComp.js";
import SongsList from "../SongsList.js";

function MoodWheel() {
  const [mood, setMood] = useState("");
  return (
    <div className="moodwheel-page">
      <video src="/videos/background.mp4" autoPlay loop muted className="dimmed-video" />
      <div className="moodwheel-page__veil" aria-hidden="true" />
      <main className="page-shell moodwheel-page__shell">
        <section className="moodwheel-page__intro page-card">
          <p className="page-kicker">Interactive Mood Wheel</p>
          <h1 className="page-heading">Pick A Feeling, Spin Into Music</h1>
          <p className="page-description">
            Select the emotional tone closest to your state and the app routes it
            into a recommendation stream tuned for that mood.
          </p>
          <p className="moodwheel-page__selection">
            Current selection: <strong>{mood ? mood.toLowerCase() : "none yet"}</strong>
          </p>
        </section>

        <section className="moodwheel-page__chart page-card">
          <MoodWheelComp setMood={setMood} />
        </section>

        <section className="moodwheel-page__songs">
          <SongsList mood={mood} />
        </section>
      </main>
    </div>
  );
}

export default MoodWheel;
