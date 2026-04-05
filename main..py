from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import health, insights
from utils.firebase import init_firebase

app = FastAPI(title="LifeLytics API")

# 1. Initialize Firebase (important)
init_firebase()

# 2. Middleware (for frontend connection)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include routes
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(insights.router, prefix="/insights", tags=["Insights"])

# 4. Root endpoint (for testing)
@app.get("/")
def root():
    return {"message": "API is running"}