from io import BytesIO
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as app_module
from image_processing import NoFaceDetectedError


def test_songs_requires_arg1():
    client = app_module.app.test_client()
    response = client.get("/api/songs")

    assert response.status_code == 400
    assert response.get_json()["error"] == "Missing required query parameter: arg1"


def test_songs_returns_sorted_rows(monkeypatch):
    client = app_module.app.test_client()
    app_module.PREVIEW_CACHE.clear()
    monkeypatch.setattr(app_module, "lookup_preview_url", lambda *_args, **_kwargs: None)
    response = client.get("/api/songs?arg1=happy&shuffle=false")

    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)
    assert payload
    assert payload[0]["mood"].lower() == "happy"


def test_songs_prioritizes_playlist_rows(monkeypatch):
    client = app_module.app.test_client()
    original_df = app_module.DATAFRAME
    app_module.PREVIEW_CACHE.clear()
    try:
        app_module.DATAFRAME = app_module.pd.DataFrame(
            [
                {
                    "name": "Generic Calm",
                    "album": "A",
                    "artist": "Artist A",
                    "id": "base-1",
                    "mood": "calm",
                    "popularity": 99,
                    "preview_url": None,
                    "source": None,
                },
                {
                    "name": "Playlist Calm 1",
                    "album": "B",
                    "artist": "Artist B",
                    "id": "playlist-1",
                    "mood": "calm",
                    "popularity": 78,
                    "preview_url": None,
                    "source": "playlist:abc",
                },
                {
                    "name": "Playlist Calm 2",
                    "album": "C",
                    "artist": "Artist C",
                    "id": "playlist-2",
                    "mood": "calm",
                    "popularity": 66,
                    "preview_url": None,
                    "source": "playlist:abc",
                },
            ]
        )

        monkeypatch.setattr(
            app_module, "lookup_preview_url", lambda *_args, **_kwargs: None
        )
        response = client.get("/api/songs?arg1=neutral&limit=3&shuffle=false")

        payload = response.get_json()
        assert response.status_code == 200
        assert [row["id"] for row in payload] == ["playlist-1", "playlist-2", "base-1"]
    finally:
        app_module.DATAFRAME = original_df


def test_camera_requires_snapshot_file():
    client = app_module.app.test_client()
    response = client.post("/api/camera", data={}, content_type="multipart/form-data")

    assert response.status_code == 400
    assert response.get_json()["error"] == "Snapshot file not found"


def test_camera_rejects_invalid_extension():
    client = app_module.app.test_client()
    response = client.post(
        "/api/camera",
        data={"snapshot": (BytesIO(b"hello"), "snapshot.txt")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 415


def test_camera_returns_label_and_genre_when_processing_succeeds(monkeypatch):
    client = app_module.app.test_client()

    def fake_analyze_image(_path):
        return {
            "label": "happy",
            "confidence": 0.91,
            "probabilities": {"happy": 0.91},
        }

    monkeypatch.setattr(app_module, "analyze_image", fake_analyze_image)

    response = client.post(
        "/api/camera",
        data={"snapshot": (BytesIO(b"fakeimg"), "snapshot.jpg")},
        content_type="multipart/form-data",
    )

    payload = response.get_json()
    assert response.status_code == 200
    assert payload["label"] == "happy"
    assert payload["genre"] == "happy"


def test_camera_returns_422_when_no_face_detected(monkeypatch):
    client = app_module.app.test_client()

    def fake_analyze_image(_path):
        raise NoFaceDetectedError("No face detected in the uploaded image.")

    monkeypatch.setattr(app_module, "analyze_image", fake_analyze_image)

    response = client.post(
        "/api/camera",
        data={"snapshot": (BytesIO(b"fakeimg"), "snapshot.jpg")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
    assert "No face detected" in response.get_json()["error"]


def test_camera_analyze_returns_detailed_payload(monkeypatch):
    client = app_module.app.test_client()

    def fake_analyze_image(_path):
        return {
            "label": "neutral",
            "confidence": 0.55,
            "probabilities": {"neutral": 0.55, "happy": 0.20},
        }

    monkeypatch.setattr(app_module, "analyze_image", fake_analyze_image)

    response = client.post(
        "/api/camera/analyze",
        data={"snapshot": (BytesIO(b"fakeimg"), "snapshot.jpg")},
        content_type="multipart/form-data",
    )

    payload = response.get_json()
    assert response.status_code == 200
    assert payload["label"] == "neutral"
    assert payload["genre"] == "calm"
    assert payload["confidence"] == 0.55
    assert "timestamp" in payload
