"""Analytics and insights routes.

Endpoints:
- POST /insights - Generate health insights
- GET /insights/history - Get insights history
"""

from fastapi import APIRouter, Depends, HTTPException

from backend.utils import auth
from backend.services import insightService
from backend import database

router = APIRouter()


@router.post("/")
async def createInsights(userId: str = Depends(auth.getCurrentUserDependency)):
    """Generate AI-powered health insights.

    Combines rule-based analysis with LLM enhancement.
    Results are cached for 30 minutes.
    """
    try:
        result = await insightService.generateInsights(userId)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def getInsightsHistory(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get insights generation history."""
    try:
        history = database.getInsightsHistory(userId)
        return {"insights": history, "count": len(history)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

