from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import image_processing


def test_get_emotion_model_loads_with_compile_disabled(monkeypatch):
    loaded = {}
    sentinel_model = object()

    def fake_load_model(path, compile=True):
        loaded["path"] = path
        loaded["compile"] = compile
        return sentinel_model

    monkeypatch.setattr(image_processing, "load_model", fake_load_model)
    monkeypatch.setattr(image_processing, "img_to_array", object())
    monkeypatch.setattr(image_processing, "emotion_model", None)

    model = image_processing._get_emotion_model()

    assert model is sentinel_model
    assert loaded["compile"] is False
