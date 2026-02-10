import React, { useCallback, useState } from "react";
import { UploadFile } from "@mui/icons-material";
import { useDropzone } from "react-dropzone";
import SongsList from "../SongsList.js";
import "./Upload.css";

export default function Upload() {
  const [mood, setMood] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) {
      return;
    }

    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("snapshot", acceptedFiles[0]);

      const response = await fetch("/api/camera", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (response.ok && payload?.label) {
        setMood(payload.label);
      } else {
        setErrorMessage(payload?.error || "Error processing snapshot on the server.");
      }
    } catch (error) {
      setErrorMessage("Error sending snapshot to the server.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
    },
  });

  return (
    <div className="upload-page">
      <video src="/videos/background.mp4" autoPlay loop muted className="dimmed-video" />
      <div className="upload-page__veil" aria-hidden="true" />
      <main className="page-shell upload-page__shell">
        <section className="upload-page__panel page-card">
          <p className="page-kicker">Image Mood Capture</p>
          <h1 className="page-heading">Drop One Photo, Get Mood-Based Tracks</h1>
          <p className="page-description">
            Upload a face image and the app will infer your emotion signal to recommend
            songs that match your current vibe.
          </p>
          <div
            {...getRootProps()}
            className={`upload-dropzone ${isDragActive ? "upload-dropzone--active" : ""}`}
            role="button"
            aria-label="Upload an image"
          >
            <input {...getInputProps()} />
            <UploadFile className="upload-dropzone__icon" />
            <strong>{isDragActive ? "Drop image to analyze" : "Select or drop image"}</strong>
            <span>Supported: JPG, PNG, WEBP</span>
          </div>

          {mood ? (
            <p className="upload-page__result">
              Detected mood: <strong>{mood.toLowerCase()}</strong>
            </p>
          ) : null}
          {errorMessage ? <p className="upload-page__error">{errorMessage}</p> : null}
        </section>

        <section className="upload-page__songs">
          <SongsList mood={mood} />
        </section>
      </main>
    </div>
  );
}
