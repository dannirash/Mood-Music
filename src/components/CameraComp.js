import React, { useEffect, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import "./CameraComp.css";

const LIVE_SMOOTHING_WINDOW = 5;
const TRAIL_WINDOW = 12;

function getDominantLabel(labels) {
  if (!labels.length) {
    return "";
  }

  const counts = labels.reduce((accumulator, label) => {
    accumulator[label] = (accumulator[label] || 0) + 1;
    return accumulator;
  }, {});

  return Object.keys(counts).reduce((bestLabel, currentLabel) => {
    const bestCount = counts[bestLabel] || 0;
    const currentCount = counts[currentLabel] || 0;
    return currentCount > bestCount ? currentLabel : bestLabel;
  }, labels[labels.length - 1]);
}

function getTopProbabilities(probabilities, maxItems = 3) {
  if (!probabilities) {
    return [];
  }

  return Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([label, probability]) => ({ label, probability }));
}

const CameraComponent = ({ setMood }) => {
  const webcamRef = useRef(null);
  const liveTimeoutRef = useRef(null);
  const liveInFlightRef = useRef(false);
  const liveLoopEnabledRef = useRef(false);
  const analyzeFrameRef = useRef(null);
  const recentPredictionsRef = useRef([]);

  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveIntervalMs, setLiveIntervalMs] = useState(1500);
  const [adaptiveCadence, setAdaptiveCadence] = useState(true);
  const [autoApplyMood, setAutoApplyMood] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0.55);
  const [errorMessage, setErrorMessage] = useState("");
  const [livePrediction, setLivePrediction] = useState(null);
  const [pendingMood, setPendingMood] = useState("");
  const [inferenceLatencyMs, setInferenceLatencyMs] = useState(null);
  const [predictionTrail, setPredictionTrail] = useState([]);

  const clearLiveTimer = () => {
    if (liveTimeoutRef.current) {
      clearTimeout(liveTimeoutRef.current);
      liveTimeoutRef.current = null;
    }
  };

  const stopLiveAnalysis = () => {
    liveLoopEnabledRef.current = false;
    clearLiveTimer();
    liveInFlightRef.current = false;
    setIsLiveMode(false);
    setIsAnalyzing(false);
  };

  useEffect(() => {
    async function getVideoDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === "videoinput");
        setVideoDevices(videoInputs);
      } catch (error) {
        setErrorMessage("Unable to access camera devices.");
      }
    }

    getVideoDevices();

    return () => {
      stopLiveAnalysis();
    };
  }, []);

  const scheduleNextAnalysis = (delayMs) => {
    if (!liveLoopEnabledRef.current) {
      return;
    }

    clearLiveTimer();
    liveTimeoutRef.current = setTimeout(() => {
      if (analyzeFrameRef.current) {
        analyzeFrameRef.current();
      }
    }, delayMs);
  };

  const getNextDelay = (confidence = 0) => {
    if (!adaptiveCadence) {
      return liveIntervalMs;
    }

    if (confidence >= 0.8) {
      return Math.min(3800, liveIntervalMs + 700);
    }

    if (confidence >= 0.6) {
      return liveIntervalMs;
    }

    return Math.max(700, liveIntervalMs - 500);
  };

  const addTrailSample = (label, confidence) => {
    setPredictionTrail((prev) => {
      const next = [...prev, { label, confidence, timestamp: Date.now() }];
      return next.slice(-TRAIL_WINDOW);
    });
  };

  const applyMoodFromPrediction = (label, confidence) => {
    const history = [...recentPredictionsRef.current, label].slice(-LIVE_SMOOTHING_WINDOW);
    recentPredictionsRef.current = history;

    const smoothedMood = getDominantLabel(history);
    const candidateMood = smoothedMood || label;
    setPendingMood(candidateMood);

    if (autoApplyMood && confidence >= minConfidence && candidateMood) {
      setMood(candidateMood);
    }
  };

  const analyzeCurrentFrame = async () => {
    if (!liveLoopEnabledRef.current || liveInFlightRef.current) {
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setErrorMessage("Unable to capture image. Please allow camera access.");
      scheduleNextAnalysis(getNextDelay(0));
      return;
    }

    liveInFlightRef.current = true;
    setIsAnalyzing(true);

    const startedAt = performance.now();
    const formData = new FormData();
    formData.append("snapshot", dataURItoBlob(imageSrc), "live-frame.jpg");

    try {
      const response = await fetch("/api/camera/analyze", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      const latency = Math.round(performance.now() - startedAt);
      setInferenceLatencyMs(latency);

      if (response.ok && payload?.label) {
        setErrorMessage("");
        setLivePrediction(payload);
        addTrailSample(payload.label, payload.confidence || 0);
        applyMoodFromPrediction(payload.label, payload.confidence || 0);
        scheduleNextAnalysis(getNextDelay(payload.confidence || 0));
      } else {
        setErrorMessage(payload?.error || "Error analyzing live frame.");

        if (response.status >= 500 || response.status === 403) {
          stopLiveAnalysis();
          return;
        }

        scheduleNextAnalysis(getNextDelay(0));
      }
    } catch (error) {
      setErrorMessage("Network error while analyzing live frame.");
      scheduleNextAnalysis(getNextDelay(0));
    } finally {
      liveInFlightRef.current = false;
      setIsAnalyzing(false);
    }
  };

  analyzeFrameRef.current = analyzeCurrentFrame;

  const resetLiveState = () => {
    recentPredictionsRef.current = [];
    setLivePrediction(null);
    setPendingMood("");
    setPredictionTrail([]);
    setInferenceLatencyMs(null);
  };

  const startLiveAnalysis = async () => {
    if (isLiveMode) {
      return;
    }

    resetLiveState();
    setErrorMessage("");
    setIsLiveMode(true);
    liveLoopEnabledRef.current = true;

    await analyzeCurrentFrame();
  };

  const restartLiveAnalysis = async () => {
    stopLiveAnalysis();
    await startLiveAnalysis();
  };

  const takeSnapshot = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setErrorMessage("Unable to capture image. Please allow camera access.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("snapshot", dataURItoBlob(imageSrc), "snapshot.jpg");

    try {
      const response = await fetch("/api/camera", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (response.ok && payload?.label) {
        setPendingMood(payload.label);
        setMood(payload.label);
      } else {
        setErrorMessage(payload?.error || "Error processing snapshot on the server.");
      }
    } catch (error) {
      setErrorMessage("Error sending snapshot to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPendingMood = () => {
    if (pendingMood) {
      setMood(pendingMood);
    }
  };

  function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(",")[1]);
    const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i += 1) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
  }

  const confidencePct = livePrediction
    ? Math.round((livePrediction.confidence || 0) * 100)
    : 0;
  const thresholdPct = Math.round(minConfidence * 100);
  const topProbabilities = useMemo(
    () => getTopProbabilities(livePrediction?.probabilities),
    [livePrediction]
  );
  const statusLabel = isLiveMode ? (isAnalyzing ? "Analyzing" : "Live") : "Paused";
  const faceHudLabel = isLiveMode
    ? isAnalyzing
      ? `Analyzing face ${confidencePct ? `(${confidencePct}%)` : ""}`
      : "Face tracking active"
    : "Start live analysis";

  return (
    <div className="camera-studio">
      <section className="camera-stage">
        <header className="camera-stage__header">
          <h2>Live Mood Lens</h2>
          <div className="stage-status-row">
            <span className={`status-chip ${isLiveMode ? "status-chip--live" : ""}`}>
              {statusLabel}
            </span>
            {inferenceLatencyMs ? (
              <span className="status-chip">{inferenceLatencyMs} ms</span>
            ) : null}
          </div>
        </header>

        <div
          className={`camera-frame ${isLiveMode ? "camera-frame--live" : ""} ${
            isAnalyzing ? "camera-frame--analyzing" : ""
          }`}
        >
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="camera-feed"
            videoConstraints={{
              facingMode: "user",
              deviceId: selectedDeviceId || undefined,
            }}
          />
          <div className="camera-grid" aria-hidden="true" />
          {isLiveMode ? <div className="camera-scanline" aria-hidden="true" /> : null}
          <div
            className={`face-lock ${isLiveMode ? "face-lock--active" : ""} ${
              isAnalyzing ? "face-lock--analyzing" : ""
            }`}
            aria-hidden="true"
          >
            <div className="face-lock__halo" />
            <div className="face-lock__contour" />
            <div className="face-lock__mesh" />
            <div className="face-lock__beam" />
            <div className="face-lock__orbit">
              <span />
              <span />
              <span />
            </div>
            <div className="face-lock__points">
              <span className="face-point face-point--left-eye" />
              <span className="face-point face-point--right-eye" />
              <span className="face-point face-point--nose" />
              <span className="face-point face-point--mouth-left" />
              <span className="face-point face-point--mouth-right" />
              <span className="face-point face-point--chin" />
            </div>
            <div className="face-lock__status">{faceHudLabel}</div>
          </div>
          <div className="camera-overlay-text">
            {pendingMood ? `Mood candidate: ${pendingMood}` : "Start live analysis"}
          </div>
        </div>

        <div className="camera-actions">
          <button className="camera-btn camera-btn--primary" onClick={takeSnapshot} disabled={isSubmitting}>
            {isSubmitting ? "Capturing..." : "Capture Mood"}
          </button>

          {isLiveMode ? (
            <button className="camera-btn camera-btn--danger" onClick={stopLiveAnalysis}>
              Stop Live
            </button>
          ) : (
            <button className="camera-btn camera-btn--accent" onClick={startLiveAnalysis}>
              Start Live
            </button>
          )}

          <button className="camera-btn camera-btn--ghost" onClick={restartLiveAnalysis}>
            Restart Loop
          </button>

          <button
            className="camera-btn camera-btn--ghost"
            onClick={applyPendingMood}
            disabled={!pendingMood}
          >
            Apply Mood
          </button>
        </div>
      </section>

      <aside className="insight-panel" aria-live="polite">
        <div className="insight-panel__top">
          <h3>Emotion Signal</h3>
          <p>Confidence-driven recommendations with smoothing and adaptive cadence.</p>
        </div>

        <div className="confidence-ring" style={{ "--confidence": `${confidencePct}` }}>
          <strong>{confidencePct}%</strong>
          <span>{livePrediction?.label || "Waiting"}</span>
        </div>

        <div className="signal-metrics">
          <div className="metric-card">
            <span>Auto Apply</span>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={autoApplyMood}
                onChange={(event) => setAutoApplyMood(event.target.checked)}
              />
              <span>{autoApplyMood ? "Enabled" : "Disabled"}</span>
            </label>
          </div>

          <div className="metric-card">
            <span>Adaptive Cadence</span>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={adaptiveCadence}
                onChange={(event) => setAdaptiveCadence(event.target.checked)}
              />
              <span>{adaptiveCadence ? "Enabled" : "Fixed"}</span>
            </label>
          </div>
        </div>

        <div className="studio-config">
          <label htmlFor="camera-select">Camera Input</label>
          <select
            id="camera-select"
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            value={selectedDeviceId}
          >
            <option value="">Default Camera</option>
            {videoDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>

          <label htmlFor="analysis-speed-select">Base Analysis Speed</label>
          <select
            id="analysis-speed-select"
            value={liveIntervalMs}
            onChange={(event) => setLiveIntervalMs(Number(event.target.value))}
          >
            <option value={900}>Ultra Fast (0.9s)</option>
            <option value={1500}>Balanced (1.5s)</option>
            <option value={2400}>Battery Saver (2.4s)</option>
          </select>

          <label htmlFor="confidence-threshold">
            Confidence Gate: <strong>{thresholdPct}%</strong>
          </label>
          <input
            id="confidence-threshold"
            type="range"
            min="35"
            max="90"
            value={thresholdPct}
            onChange={(event) => setMinConfidence(Number(event.target.value) / 100)}
          />
        </div>

        <div className="probability-panel">
          <h4>Top Emotion Probabilities</h4>
          {topProbabilities.length ? (
            <ul className="probability-list">
              {topProbabilities.map((item) => {
                const pct = Math.round(item.probability * 100);
                return (
                  <li key={item.label}>
                    <div className="probability-row">
                      <span>{item.label}</span>
                      <strong>{pct}%</strong>
                    </div>
                    <div className="probability-track">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state">No live signal yet.</p>
          )}
        </div>

        <div className="trail-panel">
          <h4>Recent Mood Trail</h4>
          <div className="trail-wrap">
            {predictionTrail.length ? (
              predictionTrail
                .slice()
                .reverse()
                .map((item, index) => (
                  <span key={`${item.timestamp}-${index}`} className="trail-chip">
                    {item.label}
                    <em>{Math.round(item.confidence * 100)}%</em>
                  </span>
                ))
            ) : (
              <p className="empty-state">Trail appears after live analysis starts.</p>
            )}
          </div>
        </div>

        {errorMessage ? <p className="camera-error">{errorMessage}</p> : null}
      </aside>
    </div>
  );
};

export default CameraComponent;
