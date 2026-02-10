#!/usr/bin/env python3
"""Import tracks from a Spotify playlist into backend/data_moods.csv and fetch album covers.

Usage:
    python backend/scripts/import_spotify_playlist.py \
      --playlist-url "https://open.spotify.com/playlist/<id>?si=..."
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List

import pandas as pd
import requests

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT_DIR / "backend" / "data_moods.csv"
COVERS_DIR = ROOT_DIR / "public" / "album_covers"

CSV_COLUMNS = [
    "name",
    "album",
    "artist",
    "id",
    "release_date",
    "popularity",
    "length",
    "danceability",
    "acousticness",
    "energy",
    "instrumentalness",
    "liveness",
    "valence",
    "loudness",
    "speechiness",
    "tempo",
    "key",
    "time_signature",
    "mood",
    "preview_url",
    "source",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Spotify playlist songs into CSV")
    parser.add_argument(
        "--playlist-url",
        required=True,
        help="Spotify playlist URL (e.g. https://open.spotify.com/playlist/<id>)",
    )
    parser.add_argument(
        "--data-path",
        default=str(DATA_PATH),
        help=f"Path to data_moods.csv (default: {DATA_PATH})",
    )
    parser.add_argument(
        "--covers-dir",
        default=str(COVERS_DIR),
        help=f"Directory for album covers (default: {COVERS_DIR})",
    )
    parser.add_argument(
        "--source-label",
        default="",
        help='Optional source label to stamp imported rows (default: "playlist:<id>")',
    )
    return parser.parse_args()


def extract_playlist_id(url: str) -> str:
    match = re.search(r"/playlist/([A-Za-z0-9]+)", url)
    if not match:
        raise ValueError("Unable to parse playlist ID from URL")
    return match.group(1)


def request_text(url: str, session: requests.Session, **kwargs) -> str:
    response = session.get(url, timeout=30, **kwargs)
    response.raise_for_status()
    return response.text


def extract_first_track_id_from_playlist_page(html: str) -> str:
    match = re.search(r'https://open\.spotify\.com/track/([A-Za-z0-9]{22})', html)
    if not match:
        raise RuntimeError("Could not find a track id in playlist page")
    return match.group(1)


def extract_next_data_json(html: str) -> dict:
    match = re.search(
        r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        html,
        flags=re.DOTALL,
    )
    if not match:
        raise RuntimeError("Could not parse __NEXT_DATA__ payload")
    return json.loads(match.group(1))


def get_web_access_token(seed_track_id: str, session: requests.Session) -> str:
    embed_url = f"https://open.spotify.com/embed/track/{seed_track_id}?utm_source=oembed"
    html = request_text(embed_url, session, headers={"User-Agent": "Mozilla/5.0"})
    data = extract_next_data_json(html)
    token = (
        data.get("props", {})
        .get("pageProps", {})
        .get("state", {})
        .get("settings", {})
        .get("session", {})
        .get("accessToken")
    )
    if not token:
        raise RuntimeError("Could not extract Spotify access token from embed page")
    return token


def paginated_playlist_tracks(
    playlist_id: str, token: str, session: requests.Session
) -> List[dict]:
    url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
    params = {"limit": 100, "offset": 0}
    headers = {"Authorization": f"Bearer {token}"}
    items: List[dict] = []

    while True:
        response = session.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        payload = response.json()
        page_items = payload.get("items", [])
        items.extend(page_items)

        if payload.get("next"):
            params["offset"] += params["limit"]
        else:
            break

    return items


def batched(iterable: Iterable[str], n: int) -> Iterable[List[str]]:
    batch: List[str] = []
    for item in iterable:
        batch.append(item)
        if len(batch) == n:
            yield batch
            batch = []
    if batch:
        yield batch


def fetch_audio_features(
    track_ids: List[str], token: str, session: requests.Session
) -> Dict[str, dict]:
    headers = {"Authorization": f"Bearer {token}"}
    features_by_id: Dict[str, dict] = {}

    for chunk in batched(track_ids, 100):
        response = session.get(
            "https://api.spotify.com/v1/audio-features",
            params={"ids": ",".join(chunk)},
            headers=headers,
            timeout=30,
        )
        if response.status_code == 403:
            # Some public web-player tokens can read playlist metadata
            # but are blocked from audio-features. Fall back gracefully.
            print(
                "Warning: audio-features endpoint returned 403; "
                "continuing without feature vectors."
            )
            return {}
        response.raise_for_status()
        payload = response.json().get("audio_features", [])
        for feature in payload:
            if feature and feature.get("id"):
                features_by_id[feature["id"]] = feature

    return features_by_id


def classify_mood(feature: dict, name: str, popularity: int | None) -> str:
    if not feature:
        text = (name or "").lower()
        sad_terms = {
            "sad",
            "cry",
            "tears",
            "lonely",
            "alone",
            "broken",
            "hurt",
            "pain",
            "miss",
            "goodbye",
            "dark",
            "lost",
        }
        energetic_terms = {
            "dance",
            "party",
            "run",
            "fast",
            "wild",
            "fire",
            "rage",
            "rock",
            "go",
            "up",
            "night",
            "move",
        }
        happy_terms = {
            "happy",
            "love",
            "sun",
            "smile",
            "joy",
            "fun",
            "shine",
            "good",
            "best",
            "beautiful",
        }

        if any(term in text for term in sad_terms):
            return "sad"
        if any(term in text for term in energetic_terms):
            return "energetic"
        if any(term in text for term in happy_terms):
            return "happy"
        if popularity is not None and popularity >= 75:
            return "happy"
        return "calm"

    valence = float(feature.get("valence", 0.0) or 0.0)
    energy = float(feature.get("energy", 0.0) or 0.0)
    tempo = float(feature.get("tempo", 0.0) or 0.0)

    if valence >= 0.62 and energy >= 0.52:
        return "happy"
    if valence <= 0.40 and energy <= 0.56:
        return "sad"
    if energy >= 0.70 or tempo >= 135:
        return "energetic"
    return "calm"


def build_rows(
    playlist_items: List[dict], features_by_id: Dict[str, dict], source_label: str
) -> List[dict]:
    rows: List[dict] = []

    for item in playlist_items:
        track = item.get("track") or {}
        if not track or track.get("id") is None:
            continue

        track_id = track["id"]
        feature = features_by_id.get(track_id, {})
        artists = ", ".join(a.get("name", "") for a in track.get("artists", []))

        row = {
            "name": track.get("name"),
            "album": (track.get("album") or {}).get("name"),
            "artist": artists,
            "id": track_id,
            "release_date": (track.get("album") or {}).get("release_date"),
            "popularity": track.get("popularity"),
            "length": track.get("duration_ms"),
            "danceability": feature.get("danceability"),
            "acousticness": feature.get("acousticness"),
            "energy": feature.get("energy"),
            "instrumentalness": feature.get("instrumentalness"),
            "liveness": feature.get("liveness"),
            "valence": feature.get("valence"),
            "loudness": feature.get("loudness"),
            "speechiness": feature.get("speechiness"),
            "tempo": feature.get("tempo"),
            "key": feature.get("key"),
            "time_signature": feature.get("time_signature"),
            "mood": classify_mood(feature, track.get("name"), track.get("popularity")),
            "preview_url": track.get("preview_url"),
            "source": source_label,
        }
        rows.append(row)

    return rows


def merge_into_csv(data_path: Path, rows: List[dict]) -> Dict[str, int]:
    existing = pd.read_csv(data_path)
    for column in CSV_COLUMNS:
        if column not in existing.columns:
            existing[column] = pd.NA
    existing = existing[CSV_COLUMNS]
    existing_ids = set(existing["id"].astype(str))

    incoming_df = pd.DataFrame(rows)
    if incoming_df.empty:
        return {"incoming": 0, "new": 0, "updated": 0, "total": len(existing)}

    for column in CSV_COLUMNS:
        if column not in incoming_df.columns:
            incoming_df[column] = pd.NA
    incoming_df = incoming_df[CSV_COLUMNS]

    new_rows = incoming_df[~incoming_df["id"].astype(str).isin(existing_ids)].copy()
    updated_rows = incoming_df[incoming_df["id"].astype(str).isin(existing_ids)].copy()

    if not updated_rows.empty:
        # refresh metadata for overlapping tracks
        existing = existing.set_index("id")
        updated_rows = updated_rows.set_index("id")
        existing.update(updated_rows)
        existing = existing.reset_index()

    if new_rows.empty:
        merged = existing.copy()
    else:
        merged = pd.concat([existing, new_rows], ignore_index=True)
    merged.to_csv(data_path, index=False)

    return {
        "incoming": len(incoming_df),
        "new": len(new_rows),
        "updated": len(updated_rows),
        "total": len(merged),
    }


def download_album_covers(
    playlist_items: List[dict], covers_dir: Path, session: requests.Session
) -> Dict[str, int]:
    covers_dir.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    skipped_existing = 0
    missing_art = 0

    for item in playlist_items:
        track = item.get("track") or {}
        track_id = track.get("id")
        if not track_id:
            continue

        target_path = covers_dir / f"{track_id}.jpg"
        if target_path.exists():
            skipped_existing += 1
            continue

        images = (track.get("album") or {}).get("images") or []
        if not images:
            missing_art += 1
            continue

        image_url = images[0].get("url")
        if not image_url:
            missing_art += 1
            continue

        response = session.get(image_url, timeout=30)
        if response.status_code == 200 and response.content:
            target_path.write_bytes(response.content)
            downloaded += 1
        else:
            missing_art += 1

    return {
        "downloaded": downloaded,
        "skipped_existing": skipped_existing,
        "missing_art": missing_art,
    }


def main() -> int:
    args = parse_args()
    playlist_id = extract_playlist_id(args.playlist_url)
    data_path = Path(args.data_path).resolve()
    covers_dir = Path(args.covers_dir).resolve()

    if not data_path.exists():
        print(f"CSV file not found: {data_path}", file=sys.stderr)
        return 1

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    playlist_page = request_text(
        f"https://open.spotify.com/playlist/{playlist_id}",
        session,
    )
    seed_track_id = extract_first_track_id_from_playlist_page(playlist_page)
    token = get_web_access_token(seed_track_id, session)

    playlist_items = paginated_playlist_tracks(playlist_id, token, session)
    track_ids = [
        item.get("track", {}).get("id")
        for item in playlist_items
        if item.get("track", {}).get("id")
    ]
    source_label = args.source_label or f"playlist:{playlist_id}"

    features_by_id = fetch_audio_features(track_ids, token, session)
    rows = build_rows(playlist_items, features_by_id, source_label)
    merge_stats = merge_into_csv(data_path, rows)
    cover_stats = download_album_covers(playlist_items, covers_dir, session)

    print("Playlist import complete")
    print(f"- Playlist ID: {playlist_id}")
    print(f"- Incoming tracks: {merge_stats['incoming']}")
    print(f"- New tracks added: {merge_stats['new']}")
    print(f"- Existing tracks refreshed: {merge_stats['updated']}")
    print(f"- Total rows in CSV: {merge_stats['total']}")
    print(f"- Covers downloaded: {cover_stats['downloaded']}")
    print(f"- Covers already present: {cover_stats['skipped_existing']}")
    print(f"- Missing cover images: {cover_stats['missing_art']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
