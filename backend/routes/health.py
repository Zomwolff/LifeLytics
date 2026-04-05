"""Health tracking routes.

Endpoints:
- POST /health/height - Record height
- POST /health/weight - Record weight
- GET /health/bmi - Get BMI calculation
- GET /health/metrics - Get all health metrics
- POST /health/smartwatch - Add smartwatch data
- GET /health/smartwatch - Get all smartwatch data
- POST /health/glucose - Add glucose reading
- GET /health/glucose - Get all glucose readings
- GET /health/all - Get complete health profile
"""

from fastapi import APIRouter, Depends, HTTPException, status

from backend.models.schemas import (
    HeightRequest,
    WeightRequest,
    SmartwatchData,
    GlucoseReading,
    BMIResponse,
)
from backend.utils import auth
from backend.services import healthService

router = APIRouter()


@router.post("/height", status_code=status.HTTP_201_CREATED)
async def postHeight(
    payload: HeightRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Record user height (in meters)."""
    try:
        await healthService.setHeight(userId, payload.height)
        return {"message": "Height recorded successfully", "height": payload.height}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weight", status_code=status.HTTP_201_CREATED)
async def postWeight(
    payload: WeightRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Record user weight (in kilograms)."""
    try:
        await healthService.setWeight(userId, payload.weight)
        return {"message": "Weight recorded successfully", "weight": payload.weight}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bmi", response_model=BMIResponse)
async def getBmi(userId: str = Depends(auth.getCurrentUserDependency)):
    """Calculate and return BMI."""
    try:
        bmi = await healthService.calculateBmi(userId)
        if bmi is None:
            raise HTTPException(
                status_code=404,
                detail="Height or weight not recorded. Please POST to /height and /weight first.",
            )
        return {"bmi": bmi}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def getMetrics(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get complete health metrics."""
    try:
        metrics = await healthService.getUserMetrics(userId)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/smartwatch", status_code=status.HTTP_201_CREATED)
async def postSmartwatch(
    payload: SmartwatchData,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Add smartwatch data (steps, heart rate, etc)."""
    try:
        await healthService.addSmartWatchData(userId, payload.dict(exclude_none=True))
        return {"message": "Smartwatch data recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/smartwatch")
async def getSmartwatch(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get all smartwatch data."""
    try:
        from backend import database

        data = database.getSmartWatchData(userId)
        return {"smartwatch": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/glucose", status_code=status.HTTP_201_CREATED)
async def postGlucose(
    payload: GlucoseReading,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Add glucose reading."""
    try:
        await healthService.addGlucoseReading(userId, payload.dict(exclude_none=True))
        return {"message": "Glucose reading recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/glucose")
async def getGlucose(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get all glucose readings."""
    try:
        from backend import database

        readings = database.getGlucoseReadings(userId)
        return {"glucose": readings, "count": len(readings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def getAllHealthData(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get complete health profile for frontend."""
    try:
        from backend import database

        data = database.getAllUserData(userId)
        return {
            "userId": userId,
            "height": data.get("height"),
            "weight": data.get("weight"),
            "bmi": await healthService.calculateBmi(userId),
            "glucose": database.getGlucoseReadings(userId),
            "smartwatch": database.getSmartWatchData(userId),
            "healthLogs": database.getHealthLogs(userId),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

