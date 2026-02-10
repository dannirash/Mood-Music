# Mood Music

Mood Music recommends songs based on how you feel using three input flows:

- live camera emotion analysis
- image upload analysis
- manual mood wheel selection

It also supports playlist imports (with album covers), shuffled recommendations, and auto-playing 30-second track previews when available.

## Features

- Live camera analysis with animated face-analysis HUD
- Manual mood selection via interactive mood wheel
- Upload a photo and infer mood from the image
- Recommendations by mood, shuffled by default
- Sequential preview playback with autoplay fallback controls
- Spotify playlist importer that updates `backend/data_moods.csv`
- Local album-cover storage in `public/album_covers`

## Tech Stack

- Frontend: React + Vite
- Backend: Flask
- Data: CSV (`backend/data_moods.csv`)
- Charts/UI: MUI X Charts + custom CSS

## Run Locally (macOS Quick Start)

### 1. Prerequisites

- Python 3.11+
- Node.js 18+ and npm

```bash
python3 --version
node --version
npm --version
```

### 2. Install dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
npm install
```

### 3. Start frontend + backend

```bash
python3 run.py
```

This starts:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:5000`

## Windows/Linux Note

- Windows venv activation:

```powershell
venv\Scripts\activate
```

- Linux venv activation:

```bash
source venv/bin/activate
```

## Import Songs From a Spotify Playlist

```bash
python3 backend/scripts/import_spotify_playlist.py \
  --playlist-url "https://open.spotify.com/playlist/<playlist_id>"
```

What it does:

- merges playlist tracks into `backend/data_moods.csv`
- tags rows with `source=playlist:<playlist_id>`
- downloads album covers into `public/album_covers`

## Recommendation API Notes

- Endpoint: `/api/songs`
- Required query param: `arg1=<mood>`
- Optional:
  - `limit` (default `24`, max `80`)
  - `shuffle` (default `true`, use `false` for deterministic order)

Example:

```bash
curl "http://127.0.0.1:5000/api/songs?arg1=neutral&limit=24&shuffle=true"
```

## Visual Preview

Use this video as the only visual reference:

- `public/videos/moodmusic.mp4` (duration: ~32.9s)

Direct link:

- [Open video](public/videos/moodmusic.mp4)

Embedded preview:

<video src="public/videos/moodmusic.mp4" controls muted loop playsinline preload="metadata" width="960"></video>

## Troubleshooting

- Camera permission issues:
  - macOS: `System Settings > Privacy & Security > Camera`
  - browser site permission must allow camera
- If preview audio does not autoplay, click `Enable Auto Preview` once
- If backend dependencies fail, re-activate venv and run:

```bash
pip install -r requirements.txt
```
