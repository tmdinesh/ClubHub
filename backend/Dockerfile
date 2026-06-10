# ── Builder stage ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build tools for native extensions (asyncpg, cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Non-root user for least privilege
RUN addgroup --system ccops && adduser --system --ingroup ccops ccops

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=ccops:ccops . .

# Media directory (volume-mounted in compose)
RUN mkdir -p /app/media && chown ccops:ccops /app/media

USER ccops

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
