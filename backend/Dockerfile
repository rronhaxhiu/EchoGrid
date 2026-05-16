# Build from repository root (see docker-compose.yml):
#   docker compose -f backend/docker-compose.yml build backend
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PEST_MODEL_DIR=/app/deployment_bundle/models \
    PYTHONPATH=/app/deployment_bundle

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Base API + ML inference (torch, xgboost, etc.)
COPY backend/requirements.txt backend/requirements-ml.txt ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt -r requirements-ml.txt

# Backend application
COPY backend/ .

# Pest-risk models + predict.py (deployment_bundle)
COPY deployment_bundle/predict.py /app/deployment_bundle/predict.py
COPY deployment_bundle/models /app/deployment_bundle/models

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
