import "../App.css";
import React, { useEffect, useState } from "react";
import axios from "axios";

import StyledTable from "./StyledTable.js";
import TextFields from "./TextFields";

export default function SongsList({ mood }) {
  const [rows, setRows] = useState([]);
  const [genre, setGenre] = useState("");

  useEffect(() => {
    if (rows.length > 0) {
      window.scrollTo({ top: 740, behavior: "smooth" });
    }
  }, [rows]);

  useEffect(() => {
    const trimmedMood = mood?.trim();
    if (!trimmedMood) {
      setRows([]);
      setGenre("");
      return;
    }

    const source = axios.CancelToken.source();

    axios
      .get("/api/songs", {
        params: { arg1: trimmedMood, limit: 24, shuffle: true },
        cancelToken: source.token,
      })
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : [];
        if (data.length > 0) {
          setGenre((data[0].mood || "").toLowerCase());
          setRows(data);
        } else {
          setGenre("");
          setRows([]);
        }
      })
      .catch((error) => {
        if (!axios.isCancel(error)) {
          setGenre("");
          setRows([]);
        }
      });

    return () => source.cancel("Songs request canceled");
  }, [mood]);

  if (mood !== "") {
    return (
      <>
        <TextFields mood={mood} genre={genre} />
        <StyledTable rows={rows} />
      </>
    );
  }

  return (
    <>
      <TextFields mood={mood} genre={genre} />
    </>
  );
}
