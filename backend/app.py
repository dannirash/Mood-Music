import os
import re
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile

import pandas as pd
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

from image_processing import EmotionDetectionError, NoFaceDetectedError, analyze_image

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent
DATAFRAME = pd.read_csv(BASE_DIR / "data_moods.csv")
UPLOAD_DIR = BASE_DIR / "pics"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB
PREVIEW_CACHE = {}
PREVIEW_CACHE_MAX_SIZE = 4000
PREVIEW_LOOKUP_TIMEOUT = 6
MAX_PREVIEW_LOOKUPS_PER_REQUEST = 12

HTTP = requests.Session()
HTTP.headers.update({"User-Agent": "Mood-Music/1.0"})

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
CORS(app, resources={r"/*": {"origins": allowed_origins}})


def choose_genre(pred_class):
    normalized = pred_class.strip().lower()
    if normalized in {"disgust", "sad"}:
        return "sad"
    if normalized == "happy":
        return "happy"
    if normalized in {"scared", "angry"}:
        return "calm"
    if normalized == "surprised":
        return "energetic"
    if normalized == "neutral":
        return "calm"
    return normalized


def _normalize_text(value):
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def _parse_bool(value, default=False):
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _cache_preview(cache_key, preview_url):
    if len(PREVIEW_CACHE) >= PREVIEW_CACHE_MAX_SIZE:
        PREVIEW_CACHE.pop(next(iter(PREVIEW_CACHE)))
    PREVIEW_CACHE[cache_key] = preview_url


def _preview_score(track_name, artist_name, candidate_track, candidate_artist):
    score = 0
    normalized_track = _normalize_text(track_name)
    normalized_artist = _normalize_text(artist_name)
    normalized_candidate_track = _normalize_text(candidate_track)
    normalized_candidate_artist = _normalize_text(candidate_artist)

    if normalized_track and normalized_track == normalized_candidate_track:
        score += 5
    elif normalized_track and normalized_track in normalized_candidate_track:
        score += 2

    if normalized_artist and normalized_artist == normalized_candidate_artist:
        score += 4
    elif normalized_artist and normalized_artist in normalized_candidate_artist:
        score += 1

    return score


def _lookup_itunes_preview(track_name, artist_name):
    response = HTTP.get(
        "https://itunes.apple.com/search",
        params={"term": f"{track_name} {artist_name}", "entity": "song", "limit": 8},
        timeout=PREVIEW_LOOKUP_TIMEOUT,
    )
    response.raise_for_status()

    results = response.json().get("results", [])
    best_url = None
    best_score = -1

    for result in results:
        preview_url = result.get("previewUrl")
        if not preview_url:
            continue
        score = _preview_score(
            track_name,
            artist_name,
            result.get("trackName", ""),
            result.get("artistName", ""),
        )
        if score > best_score:
            best_score = score
            best_url = preview_url

    return best_url


def _lookup_deezer_preview(track_name, artist_name):
    response = HTTP.get(
        "https://api.deezer.com/search",
        params={"q": f'track:"{track_name}" artist:"{artist_name}"', "limit": 8},
        timeout=PREVIEW_LOOKUP_TIMEOUT,
    )
    response.raise_for_status()

    results = response.json().get("data", [])
    best_url = None
    best_score = -1

    for result in results:
        preview_url = result.get("preview")
        if not preview_url:
            continue
        score = _preview_score(
            track_name,
            artist_name,
            result.get("title", ""),
            (result.get("artist") or {}).get("name", ""),
        )
        if score > best_score:
            best_score = score
            best_url = preview_url

    return best_url


def lookup_preview_url(track_id, track_name, artist_name):
    cache_key = str(track_id or "").strip()
    if cache_key and cache_key in PREVIEW_CACHE:
        return PREVIEW_CACHE[cache_key]

    if not track_name:
        if cache_key:
            _cache_preview(cache_key, None)
        return None

    preview_url = None
    try:
        preview_url = _lookup_itunes_preview(track_name, artist_name)
        if not preview_url:
            preview_url = _lookup_deezer_preview(track_name, artist_name)
    except requests.RequestException:
        preview_url = None

    if cache_key:
        _cache_preview(cache_key, preview_url)
    return preview_url


def _allowed_file_extension(filename):
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def _validate_snapshot_file(snapshot_file):
    if snapshot_file is None:
        return jsonify({"error": "Snapshot file not found"}), 400
    if not snapshot_file.filename:
        return jsonify({"error": "Snapshot file has no filename"}), 400
    if not _allowed_file_extension(snapshot_file.filename):
        return (
            jsonify(
                {
                    "error": (
                        "Unsupported file type. "
                        "Allowed types: .jpg, .jpeg, .png, .webp"
                    )
                }
            ),
            415,
        )
    return None


def _analyze_snapshot_file(snapshot_file):
    snapshot_name = secure_filename(snapshot_file.filename)
    suffix = Path(snapshot_name).suffix.lower() or ".jpg"
    temp_file = NamedTemporaryFile(
        delete=False, suffix=suffix, dir=UPLOAD_DIR, prefix="snapshot_"
    )
    temp_path = Path(temp_file.name)

    try:
        with temp_file:
            snapshot_file.save(temp_file.name)

        analysis = analyze_image(temp_path)
        label = analysis["label"]
        analysis["genre"] = choose_genre(label)
        analysis["timestamp"] = datetime.now(timezone.utc).isoformat()
        return analysis
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass


@app.errorhandler(413)
def payload_too_large(_error):
    return jsonify({"error": "Uploaded file is too large (max 5 MB)."}), 413


@app.get("/")
def index():
    return (
        jsonify(
            {
                "service": "Mood Music Backend",
                "status": "ok",
                "endpoints": ["/api/songs", "/api/camera", "/api/camera/analyze"],
            }
        ),
        200,
    )


@app.get("/favicon.ico")
def favicon():
    return ("", 204)


@app.get("/api/songs")
@app.get("/songs")
def data_sort():
    user_mood = request.args.get("arg1", type=str)
    if not user_mood:
        return jsonify({"error": "Missing required query parameter: arg1"}), 400
    limit = request.args.get("limit", default=24, type=int)
    if limit is None:
        limit = 24
    limit = min(max(limit, 1), 80)
    shuffle = _parse_bool(request.args.get("shuffle"), default=True)

    genre = choose_genre(user_mood)
    sorted_df = DATAFRAME[DATAFRAME["mood"].str.lower() == genre].copy()
    sorted_df = sorted_df.sort_values(by="popularity", ascending=False).copy()

    if "source" in sorted_df.columns:
        source_series = sorted_df["source"].fillna("").astype(str).str.lower()
        playlist_rows = sorted_df[source_series.str.startswith("playlist:")].copy()
        non_playlist_rows = sorted_df[~source_series.str.startswith("playlist:")].copy()
        if shuffle:
            if not playlist_rows.empty:
                playlist_rows = playlist_rows.sample(frac=1).copy()
            if not non_playlist_rows.empty:
                non_playlist_rows = non_playlist_rows.sample(frac=1).copy()
        sorted_df = pd.concat([playlist_rows, non_playlist_rows], ignore_index=True)
    elif shuffle and not sorted_df.empty:
        sorted_df = sorted_df.sample(frac=1).copy()

    sorted_df = sorted_df.head(limit).copy()
    if "preview_url" not in sorted_df.columns:
        sorted_df["preview_url"] = None

    payload = []
    preview_lookups = 0
    for _, row in sorted_df.iterrows():
        preview_url = row.get("preview_url")
        if not isinstance(preview_url, str) or not preview_url.strip():
            if preview_lookups < MAX_PREVIEW_LOOKUPS_PER_REQUEST:
                preview_url = lookup_preview_url(row.get("id"), row.get("name"), row.get("artist"))
                preview_lookups += 1
            else:
                preview_url = None

        payload.append(
            {
                "name": row.get("name"),
                "album": row.get("album"),
                "artist": row.get("artist"),
                "id": row.get("id"),
                "mood": row.get("mood"),
                "preview_url": preview_url,
            }
        )

    return jsonify(payload), 200


@app.post("/api/camera")
@app.post("/camera")
def process_image_endpoint():
    snapshot_file = request.files.get("snapshot")
    validation_error = _validate_snapshot_file(snapshot_file)
    if validation_error:
        return validation_error

    try:
        analysis = _analyze_snapshot_file(snapshot_file)
        return jsonify({"label": analysis["label"], "genre": analysis["genre"]}), 200
    except NoFaceDetectedError as exc:
        return jsonify({"error": str(exc)}), 422
    except EmotionDetectionError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        app.logger.exception("Unexpected error in /camera")
        return jsonify({"error": "Unexpected error processing image."}), 500


@app.post("/api/camera/analyze")
@app.post("/camera/analyze")
def analyze_camera_frame_endpoint():
    snapshot_file = request.files.get("snapshot")
    validation_error = _validate_snapshot_file(snapshot_file)
    if validation_error:
        return validation_error

    try:
        analysis = _analyze_snapshot_file(snapshot_file)
        return jsonify(analysis), 200
    except NoFaceDetectedError as exc:
        return jsonify({"error": str(exc)}), 422
    except EmotionDetectionError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        app.logger.exception("Unexpected error in /camera/analyze")
        return jsonify({"error": "Unexpected error processing image."}), 500


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(debug=debug)
