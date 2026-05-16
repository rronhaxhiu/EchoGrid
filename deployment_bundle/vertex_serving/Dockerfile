# Build from repo root:
#   docker build -t YOUR_REGION-docker.pkg.dev/PROJECT/REPO/pest-risk:latest -f vertex_serving/Dockerfile .
#
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements_inference.txt /app/requirements_inference.txt
COPY vertex_serving/requirements_vertex_server.txt /app/requirements_vertex_server.txt
RUN pip install --upgrade pip \
    && pip install -r /app/requirements_inference.txt -r /app/requirements_vertex_server.txt

COPY predict.py /app/predict.py
COPY models /app/models

COPY vertex_serving/server.py /app/server.py
COPY vertex_serving/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
    && chmod +x /entrypoint.sh \
    && chown -R nobody:nogroup /app /entrypoint.sh

ENV AIP_HTTP_PORT=8080
EXPOSE 8080

USER nobody:nogroup

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
