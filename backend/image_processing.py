from pathlib import Path

try:
    import cv2
except ImportError:  # pragma: no cover - dependency may be absent in CI/test envs.
    cv2 = None

try:
    import numpy as np
except ImportError:  # pragma: no cover - dependency may be absent in CI/test envs.
    np = None

try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.image import img_to_array
except ImportError:  # pragma: no cover - dependency may be absent in CI/test envs.
    load_model = None
    img_to_array = None


class EmotionDetectionError(Exception):
    """Base exception for image processing failures."""


class NoFaceDetectedError(EmotionDetectionError):
    """Raised when no face is detected in the input image."""


BASE_DIR = Path(__file__).resolve().parent
FACE_CASCADE_PATH = BASE_DIR / "haarcascade_files" / "haarcascade_frontalface_default.xml"
MODEL_PATH = BASE_DIR / "models" / "_mini_XCEPTION.102-0.66.hdf5"
EMOTIONS = ["angry", "disgust", "scared", "happy", "sad", "surprised", "neutral"]

face_cascade = None
emotion_model = None


def _get_face_cascade():
    global face_cascade

    if cv2 is None or np is None:
        raise EmotionDetectionError(
            "OpenCV and NumPy are required for camera analysis. Install requirements.txt."
        )

    if face_cascade is None:
        face_cascade = cv2.CascadeClassifier(str(FACE_CASCADE_PATH))
        if face_cascade.empty():
            raise EmotionDetectionError(
                f"Unable to load face cascade at: {FACE_CASCADE_PATH}"
            )

    return face_cascade


def _get_emotion_model():
    global emotion_model

    if load_model is None or img_to_array is None:
        raise EmotionDetectionError(
            "TensorFlow is not installed. Install dependencies from requirements.txt."
        )

    if emotion_model is None:
        try:
            # This model is used only for inference; avoid compiling legacy optimizer config.
            emotion_model = load_model(str(MODEL_PATH), compile=False)
        except Exception as exc:
            raise EmotionDetectionError(f"Failed to load emotion model: {exc}") from exc

    return emotion_model


def analyze_image(snapshot_path):
    """Return detailed emotion analysis for the most prominent detected face."""
    cascade = _get_face_cascade()
    model = _get_emotion_model()

    image = cv2.imread(str(snapshot_path))
    if image is None:
        raise EmotionDetectionError("Unable to load the uploaded image.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))

    if len(faces) == 0:
        raise NoFaceDetectedError("No face detected in the uploaded image.")

    # Choose the largest face by area (w * h).
    fX, fY, fW, fH = max(faces, key=lambda face: face[2] * face[3])
    roi = gray[fY : fY + fH, fX : fX + fW]
    if roi.size == 0:
        raise EmotionDetectionError("Detected face region is empty.")

    roi = cv2.resize(roi, (64, 64))
    roi = roi.astype("float32") / 255.0
    roi = img_to_array(roi)
    roi = np.expand_dims(roi, axis=0)

    preds = model.predict(roi, verbose=0)[0]
    emotion_index = int(np.argmax(preds))
    label = EMOTIONS[emotion_index]
    confidence = float(preds[emotion_index])
    probabilities = {
        emotion: float(probability)
        for emotion, probability in zip(EMOTIONS, preds)
    }

    return {
        "label": label,
        "confidence": confidence,
        "probabilities": probabilities,
    }


def process_image(snapshot_path):
    """Backward-compatible helper that returns only the predicted emotion label."""
    return analyze_image(snapshot_path)["label"]
