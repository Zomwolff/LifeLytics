"""Analytics and insights routes.

Endpoints:
- POST /insights - Generate health insights
- POST /insights/trends-context - Store weekly trends payload
- GET /insights/history - Get insights history
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.utils import auth
from backend.services import insightService
from backend.utils import firestore_db

router = APIRouter()


class WeeklyTrendsPayload(BaseModel):
    dates: List[str] = Field(default_factory=list)
    sleep: List[float] = Field(default_factory=list)
    steps: List[float] = Field(default_factory=list)
    glucose: List[float] = Field(default_factory=list)
    heart_rate: List[float] = Field(default_factory=list)
    calories_intake: List[float] = Field(default_factory=list)
    weeklySleep: Optional[List[float]] = None
    weeklySteps: Optional[List[float]] = None
    weeklyBloodGlucose: Optional[List[float]] = None
    weeklyCaloriesIntake: Optional[List[float]] = None
    weeklyCaloriesBurned: Optional[List[float]] = None
    weeklyProtein: Optional[List[float]] = None
    weeklyCarbs: Optional[List[float]] = None
    weeklyFats: Optional[List[float]] = None


@router.post("/trends-context")
async def saveTrendsContext(
    payload: WeeklyTrendsPayload,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Persist the exact trends-page payload so insights can use it later."""
    try:
        saved = await firestore_db.saveTrendContext(userId, payload.model_dump(exclude_none=True))
        if not saved:
            raise HTTPException(status_code=500, detail="Could not save trends context")
        return {"ok": True, "userId": userId}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        history = await firestore_db.getInsights(userId)
        return {"insights": history, "count": len(history)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

