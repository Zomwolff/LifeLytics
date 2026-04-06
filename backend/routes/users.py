"""User profile routes."""
from fastapi import APIRouter, Depends, HTTPException
from backend.utils import auth
from backend.services import userService
from backend.models.schemas import (
    CreateProfileRequest,
    UpdateProfileFieldRequest,
    SaveMetricsRequest,
    UserProfileResponse,
)

router = APIRouter()


@router.post("/profile", response_model=UserProfileResponse)
async def createProfile(
    payload: CreateProfileRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    try:
        profile = await userService.createProfile(userId, payload.name, payload.email)
        return profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile", response_model=UserProfileResponse)
async def getProfile(userId: str = Depends(auth.getCurrentUserDependency)):
    profile = await userService.getProfile(userId)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/profile", response_model=UserProfileResponse)
async def updateField(
    payload: UpdateProfileFieldRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    try:
        profile = await userService.updateField(userId, payload.field, payload.value)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metrics", response_model=UserProfileResponse)
async def saveMetrics(
    payload: SaveMetricsRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    try:
        profile = await userService.saveMetrics(
            userId,
            payload.heightCm,
            payload.weightKg,
            payload.targetSteps,
            payload.caloriesTarget,
        )
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))