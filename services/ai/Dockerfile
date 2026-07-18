FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AI_FACE_MODEL_PATH=/app/models/blaze_face_short_range.tflite \
    MPLCONFIGDIR=/tmp/cutg-matplotlib \
    XDG_CACHE_HOME=/tmp/cutg-cache

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt pyproject.toml ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
RUN python scripts/download_models.py

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
