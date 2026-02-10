import React from "react";
import "./TextFields.css";

export default function TextFields({ mood, genre }) {
  const normalizedMood = mood ? mood.toLowerCase() : "";

  if (normalizedMood !== "" && genre !== "") {
    return (
      <div className="text-fields-container">
        {genre ? (
          <>
            <h2 className="centered-text">Detected mood: {normalizedMood}</h2>
            <h1 className="centered-text">{genre} recommendations are ready</h1>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="text-fields-container">
      <h2 className="centered-text">How are you feeling right now?</h2>
    </div>
  );
}
