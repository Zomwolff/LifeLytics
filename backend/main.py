r"""Main FastAPI app entry - LifeLytics Backend.

SETUP INSTRUCTIONS (local dev):
1. Create virtual environment:
   python -m venv .venv
2. Activate (Windows):
   .\venv\Scripts\Activate.ps1
3. Install dependencies:
   pip install fastapi uvicorn firebase-admin python-multipart pydantic httpx

4. Set environment variable (optional for LLM):
   set OPENROUTER_API_KEY=your_key_here

5. Place Firebase credentials:
   Copy `lifelytics-e92fd-firebase-adminsdk-fbsvc-cf79d1af99.json` to project root

RUN (dev):
   uvicorn backend.main:app --reload --port 8000

OPTIMIZATION Features:
- Async/await for all I/O operations
- Caching system for insights (30-minute TTL)
- Rate limiting on LLM calls
- Comprehensive logging for performance tracking
- Automatic fallback to rule-based analysis on LLM failure
- Timeout handling for external API calls

Notes:
- Firebase credentials file must exist for authentication
- LLM integration is optional (graceful fallback if unavailable)
- All endpoints are async for better performance
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os

from backend.routes import health, insights, upload, chatbot, test
from backend.utils.firebase import initializeFirebase
from backend.utils.logger import getLogger, logger as backendLogger

# Get logger instance
logger = getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup and shutdown logic."""
    # Startup
    logger.info("Starting LifeLytics Backend...")
    
    # Load environment variables from .env file
    load_dotenv()
    logger.info("Environment variables loaded from .env file")
    
    # Check if API key is loaded
    api_key = os.getenv("OPENROUTER_API_KEY")
    if api_key:
        logger.info("OPENROUTER_API_KEY found - LLM integration enabled")
    else:
        logger.warning("OPENROUTER_API_KEY not found - LLM will fall back to rule-based analysis")
    
    logger.info("Features: Async I/O, Caching, Rate Limiting, LLM Integration")
    try:
        initializeFirebase()
        logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.warning(f"Firebase initialization: {str(e)}")
    yield
    # Shutdown
    logger.info("Shutting down LifeLytics Backend")


app = FastAPI(
    title="LifeLytics Backend API",
    description="Health tracking application with Firebase auth and LLM insights",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(health.router, prefix="/health", tags=["Health Tracking"])
app.include_router(insights.router, prefix="/insights", tags=["Analytics & Insights"])
app.include_router(upload.router, prefix="/upload", tags=["Document Upload"])
app.include_router(chatbot.router, prefix="/chatbot", tags=["AI Chat"])
app.include_router(test.router, prefix="/test", tags=["Data Simulation & Testing"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "LifeLytics Backend",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/health/status")
async def healthCheck():
    """Detailed health status."""
    return {"status": "healthy", "service": "LifeLytics"}

