# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install deps into a prefix so we can copy them cleanly
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Pull installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY backend/ ./backend/

# Firebase service-account key (mount as secret in prod; baked-in for local dev)
# If you use Docker Compose, prefer a bind-mount or secret over baking this in.
#COPY lifelytics-e92fd-firebase-adminsdk-fbsvc-cf79d1af99.json ./

# Runtime env defaults (override at `docker run` / Compose time)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    OPENROUTER_API_KEY=""

EXPOSE 8000

USER appuser

# Uvicorn with sensible worker count; tweak --workers for your CPU count
CMD ["uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--log-level", "info"]