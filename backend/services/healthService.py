"""Health tracking service backed by Firestore."""

from datetime import datetime
from typing import Any, Dict, Optional

from backend.utils import firestore_db


async def ensureUser(userId: str) -> None:
    """Ensure user record exists in Firestore."""
    profile = await firestore_db.getUserProfile(userId)
    if profile:
        return
    await firestore_db.createUser(
        userId,
        {
            "userId": userId,
            "createdAt": datetime.now().isoformat(),
        },
    )


async def setHeight(userId: str, height: float) -> None:
    """Set user height in meters on user doc."""
    await ensureUser(userId)
    await firestore_db.updateUserProfile(
        userId,
        {
            "height": height,
            "heightCm": round(height * 100, 1),
        },
    )


async def setWeight(userId: str, weight: float) -> None:
    """Set user weight in kilograms on user doc."""
    await ensureUser(userId)
    await firestore_db.updateUserProfile(
        userId,
        {
            "weight": weight,
            "weightKg": weight,
        },
    )


async def calculateBmi(userId: str) -> Optional[float]:
    """Calculate BMI from stored height and weight.

    Height expected in meters.
    Returns: BMI value rounded to 2 decimals, or None if data missing.
    """
    data = await firestore_db.getUserProfile(userId) or {}
    height = data.get("height")
    if not height and data.get("heightCm"):
        height = float(data.get("heightCm")) / 100.0

    weight = data.get("weight") if data.get("weight") is not None else data.get("weightKg")

    if not height or not weight:
        return None

    try:
        bmi = weight / (height * height)
        return round(bmi, 2)
    except (ZeroDivisionError, TypeError):
        return None


async def addSmartWatchData(userId: str, payload: Dict[str, Any]) -> None:
    """Add smartwatch data (steps, heart rate, etc)."""
    await firestore_db.addCollectionDoc(userId, "smartwatch", payload)


async def addGlucoseReading(userId: str, payload: Dict[str, Any]) -> None:
    """Add glucose reading."""
    await firestore_db.addCollectionDoc(userId, "glucose", payload)


async def addHealthLog(userId: str, logData: Dict[str, Any]) -> None:
    """Add general health log entry."""
    await firestore_db.addHealthLog(userId, logData)


async def getUserMetrics(userId: str) -> Dict[str, Any]:
    """Get user health metrics (height, weight, BMI)."""
    data = await firestore_db.getUserProfile(userId) or {}
    bmi = await calculateBmi(userId)

    return {
        "height": data.get("height"),
        "weight": data.get("weight"),
        "bmi": bmi,
    }
