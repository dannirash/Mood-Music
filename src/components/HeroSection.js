import React from "react";
import "../App.css";
import "./HeroSection.css";
import { ButtonCamera } from "./buttons/ButtonCamera";
import { ButtonWheel } from "./buttons/ButtonWheel";
import { ButtonUpload } from "./buttons/ButtonUpload";

function HeroSection() {
  return (
    <section className="hero-container">
      <video src="/videos/background.mp4" autoPlay loop muted className="dimmed-video" />
      <div className="hero-backdrop-mask" aria-hidden="true" />
      <div className="hero-content page-card">
        <p className="hero-kicker">Emotion Driven Listening</p>
        <h1>Find The Right Track For The Moment You Are In</h1>
        <p>
          Blend mood wheel input, live camera analysis, and image understanding to
          generate recommendations that feel intentional, not random.
        </p>
        <div className="hero-stat-row" aria-hidden="true">
          <span>Live Face Signal</span>
          <span>Adaptive Confidence</span>
          <span>Mood-Based Shuffle</span>
        </div>
        <div className="hero-btns">
          <ButtonWheel
            className="btns"
            buttonStyle="btn--outline"
            buttonSize="btn--large"
          >
            Mood Wheel
          </ButtonWheel>

          <ButtonCamera
            className="btns"
            buttonStyle="btn--outline"
            buttonSize="btn--large"
          >
            Camera AI
          </ButtonCamera>

          <ButtonUpload
            className="btns"
            buttonStyle="btn--outline"
            buttonSize="btn--large"
          >
            Upload Image
          </ButtonUpload>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
