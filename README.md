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

## Visual Reference (Single Source)

Use only this video as visual reference:

- `public/videos/moodmusic.mp4` (duration: ~32.9s)

## Screenshot Placeholders (From Video Only)

Create screenshots only from `public/videos/moodmusic.mp4` and save as:

- `docs/screenshots/video-01-00-02.png`
- `docs/screenshots/video-02-00-06.png`
- `docs/screenshots/video-03-00-10.png`
- `docs/screenshots/video-04-00-14.png`
- `docs/screenshots/video-05-00-18.png`
- `docs/screenshots/video-06-00-22.png`
- `docs/screenshots/video-07-00-26.png`
- `docs/screenshots/video-08-00-30.png`

Markdown placeholders:

![Video Frame 01](docs/screenshots/video-01-00-02.png)
![Video Frame 02](docs/screenshots/video-02-00-06.png)
![Video Frame 03](docs/screenshots/video-03-00-10.png)
![Video Frame 04](docs/screenshots/video-04-00-14.png)
![Video Frame 05](docs/screenshots/video-05-00-18.png)
![Video Frame 06](docs/screenshots/video-06-00-22.png)
![Video Frame 07](docs/screenshots/video-07-00-26.png)
![Video Frame 08](docs/screenshots/video-08-00-30.png)

## What To Screenshot

Capture these exact timestamps from `public/videos/moodmusic.mp4`:

1. `00:02` -> `video-01-00-02.png`
2. `00:06` -> `video-02-00-06.png`
3. `00:10` -> `video-03-00-10.png`
4. `00:14` -> `video-04-00-14.png`
5. `00:18` -> `video-05-00-18.png`
6. `00:22` -> `video-06-00-22.png`
7. `00:26` -> `video-07-00-26.png`
8. `00:30` -> `video-08-00-30.png`

Example extraction command:

```bash
ffmpeg -ss 00:10 -i public/videos/moodmusic.mp4 -frames:v 1 docs/screenshots/video-03-00-10.png
```

## Screenshot Tips

- Keep filenames exactly as listed above
- Use the same video file every time (`public/videos/moodmusic.mp4`)
- Do not use UI page screenshots as references for this section

## Troubleshooting

- Camera permission issues:
  - macOS: `System Settings > Privacy & Security > Camera`
  - browser site permission must allow camera
- If preview audio does not autoplay, click `Enable Auto Preview` once
- If backend dependencies fail, re-activate venv and run:

```bash
pip install -r requirements.txt
```
