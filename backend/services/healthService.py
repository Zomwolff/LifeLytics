"""Health tracking service.

Handles height, weight, BMI calculations, and health data storage.
"""

from typing import Any, Dict, Optional

from backend import database


async def ensureUser(userId: str) -> None:
    """Ensure user record exists."""
    database.getUserData(userId)


async def setHeight(userId: str, height: float) -> None:
    """Set user height in meters."""
    database.setUserHeight(userId, height)


async def setWeight(userId: str, weight: float) -> None:
    """Set user weight in kilograms."""
    database.setUserWeight(userId, weight)


async def calculateBmi(userId: str) -> Optional[float]:
    """Calculate BMI from stored height and weight.

    Height expected in meters.
    Returns: BMI value rounded to 2 decimals, or None if data missing.
    """
    data = database.getUserData(userId)
    height = data.get("height")
    weight = data.get("weight")

    if not height or not weight:
        return None

    try:
        bmi = weight / (height * height)
        return round(bmi, 2)
    except (ZeroDivisionError, TypeError):
        return None


async def addSmartWatchData(userId: str, payload: Dict[str, Any]) -> None:
    """Add smartwatch data (steps, heart rate, etc)."""
    database.addSmartWatchData(userId, payload)


async def addGlucoseReading(userId: str, payload: Dict[str, Any]) -> None:
    """Add glucose reading."""
    database.addGlucoseReading(userId, payload)


async def addHealthLog(userId: str, logData: Dict[str, Any]) -> None:
    """Add general health log entry."""
    database.addHealthLog(userId, logData)


async def getUserMetrics(userId: str) -> Dict[str, Any]:
    """Get user health metrics (height, weight, BMI)."""
    data = database.getUserData(userId)
    bmi = await calculateBmi(userId)

    return {
        "height": data.get("height"),
        "weight": data.get("weight"),
        "bmi": bmi,
    }
