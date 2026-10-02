# ARIA — Django API (backend/)
# Multi-stage build: wheels compiled in a builder stage, copied into a slim
# runtime. Runs as a non-root user; mysqlclient needs system libs at build time
# but only the runtime .so files at run time.

FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        default-libmysqlclient-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=ARIA.settings

# mariadb (libmariadb3) provides libmariadb.so.3 at runtime — the only
# non-Python shared object mysqlclient needs. curl is for healthcheck,
# libgomp1 is for faiss-cpu OpenMP multithreading.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libmariadb3 \
        curl \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin aria

WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

COPY --chown=aria:aria manage.py ./
COPY --chown=aria:aria ARIA ./ARIA
COPY --chown=aria:aria api ./api
COPY --chown=aria:aria agent ./agent
COPY --chown=aria:aria rag ./rag
COPY --chown=aria:aria evals ./evals
COPY --chown=aria:aria entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && mkdir -p /app/staticfiles && chown -R aria:aria /app

USER aria

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
