import React, { useState } from "react";
import "../../App.css";
import CameraComp from "../CameraComp.js";
import SongsList from "../SongsList.js";

function Camera() {
  const [isModal, setModal] = useState(false);
  const [mood, setMood] = useState("");
  return (
    <div className="">
      <video src="/videos/background.mp4" autoPlay loop muted className="dimmed-video" />
      <div className="image-container">
        <div className="camerClass">
          <CameraComp setMood={setMood} setModal={setModal} />
        </div></div>
      <div>
        <SongsList mood={mood} />
      </div>
    </div>
  );
}

export default Camera;


