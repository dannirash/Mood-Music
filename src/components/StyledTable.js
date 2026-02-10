import React, { useEffect, useMemo, useRef, useState } from "react";
import "./StyledTable.css";

function findNextPreviewIndex(rows, startIndex = 0) {
  if (!rows.length) {
    return -1;
  }

  const normalizedStart =
    ((startIndex % rows.length) + rows.length) % rows.length;

  for (let offset = 0; offset < rows.length; offset += 1) {
    const index = (normalizedStart + offset) % rows.length;
    if (rows[index]?.previewUrl) {
      return index;
    }
  }

  return -1;
}

export default function StyledTable({ rows }) {
  const [songData, setSongData] = useState([]);
  const [scrollX, setScrollX] = useState(0);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(-1);
  const [autoPreviewEnabled, setAutoPreviewEnabled] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const scrollContainerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!Array.isArray(rows)) {
      setSongData([]);
      return;
    }

    const songDetails = rows.map((row) => ({
      ...row,
      albumImageUrl: `/album_covers/${row.id}.jpg`,
      previewUrl: row.preview_url || null,
    }));
    setSongData(songDetails);
    setAutoPreviewEnabled(true);
    setAutoplayBlocked(false);
    setScrollX(0);
  }, [rows]);

  useEffect(() => {
    const firstPreviewIndex = findNextPreviewIndex(songData, 0);
    setCurrentPreviewIndex(firstPreviewIndex);
  }, [songData]);

  const hasAnyPreview = useMemo(
    () => songData.some((row) => !!row.previewUrl),
    [songData]
  );

  const currentPreviewTrack =
    currentPreviewIndex >= 0 ? songData[currentPreviewIndex] : null;

  useEffect(() => {
    if (!autoPreviewEnabled || !currentPreviewTrack?.previewUrl) {
      if (!autoPreviewEnabled) {
        audioRef.current?.pause();
      }
      return;
    }

    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    audioElement.currentTime = 0;
    const playPromise = audioElement.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        setAutoPreviewEnabled(false);
        setAutoplayBlocked(true);
      });
    }
  }, [autoPreviewEnabled, currentPreviewTrack]);

  const scrollLeft = () => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const newScrollX = Math.max(0, scrollX - 320);
    setScrollX(newScrollX);
    scrollContainer.scrollLeft = newScrollX;
  };

  const scrollRight = () => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const maxScroll = Math.max(
      0,
      scrollContainer.scrollWidth - scrollContainer.clientWidth
    );
    const newScrollX = Math.min(maxScroll, scrollX + 320);
    setScrollX(newScrollX);
    scrollContainer.scrollLeft = newScrollX;
  };

  const playNextPreview = () => {
    const nextIndex = findNextPreviewIndex(songData, currentPreviewIndex + 1);
    if (nextIndex >= 0) {
      setCurrentPreviewIndex(nextIndex);
    }
  };

  const toggleAutoPreview = () => {
    if (autoPreviewEnabled) {
      setAutoPreviewEnabled(false);
      audioRef.current?.pause();
      return;
    }

    setAutoplayBlocked(false);
    setAutoPreviewEnabled(true);

    if (currentPreviewIndex < 0) {
      const firstPreviewIndex = findNextPreviewIndex(songData, 0);
      setCurrentPreviewIndex(firstPreviewIndex);
    }
  };

  if (rows) {
    return (
      <div className="list-container">
        <div className="preview-toolbar">
          <div className="preview-toolbar__label">
            {hasAnyPreview ? (
              currentPreviewTrack ? (
                <>
                  Now previewing:{" "}
                  <strong>
                    {currentPreviewTrack.name} - {currentPreviewTrack.artist}
                  </strong>
                </>
              ) : (
                "Preview queue ready."
              )
            ) : (
              "No preview clips found for this recommendation set."
            )}
          </div>
          {hasAnyPreview ? (
            <button className="preview-toggle-btn" onClick={toggleAutoPreview}>
              {autoPreviewEnabled
                ? "Pause Auto Preview"
                : autoplayBlocked
                  ? "Enable Auto Preview"
                  : "Resume Auto Preview"}
            </button>
          ) : null}
        </div>

        <audio
          ref={audioRef}
          key={currentPreviewTrack?.id || "no-preview"}
          src={currentPreviewTrack?.previewUrl || ""}
          onEnded={playNextPreview}
          onError={playNextPreview}
          preload="none"
        />

        <button onClick={scrollLeft} className="scroll-button">
          {"<"}
        </button>
        <div
          ref={scrollContainerRef}
          id="scroll-container"
          className="scroll-container"
          onScroll={(event) => setScrollX(event.target.scrollLeft)}
        >
          {songData.map((row) => {
            const isNowPlaying = currentPreviewTrack?.id === row.id;
            return (
              <div
                key={row.id}
                className={`song-item ${isNowPlaying ? "song-item--now-playing" : ""}`}
              >
                <img src={row.albumImageUrl} alt={`${row.album} cover`} />
                <div className="song-title">{row.name}</div>
                <div className="song-artist">{row.artist}</div>
                <div
                  className={`song-preview-tag ${row.previewUrl ? "song-preview-tag--active" : ""}`}
                >
                  {row.previewUrl ? "30s preview available" : "Preview unavailable"}
                </div>
                <a
                  href={`https://open.spotify.com/track/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="spotify-button"
                >
                  <i className="fa-3x fa-brands fa-spotify spotify-green-icon"></i>
                </a>
              </div>
            );
          })}
        </div>
        <button onClick={scrollRight} className="scroll-button">
          {">"}
        </button>
      </div>
    );
  }

  return null;
}
