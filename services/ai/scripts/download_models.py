from pathlib import Path
from urllib.request import urlopen

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_detector/"
    "blaze_face_short_range/float16/latest/blaze_face_short_range.tflite"
)
destination = Path(__file__).resolve().parents[1] / "models" / "blaze_face_short_range.tflite"
destination.parent.mkdir(parents=True, exist_ok=True)
if not destination.exists():
    with urlopen(MODEL_URL, timeout=60) as response:  # noqa: S310 - fixed trusted model URL
        destination.write_bytes(response.read())
print(destination)
