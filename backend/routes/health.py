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
- GET /health/trends - Get weekly trends from Firestore
- GET /health/all - Get complete health profile
"""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date, timedelta
import re

from backend.models.schemas import (
    HeightRequest,
    WeightRequest,
    SmartwatchData,
    GlucoseReading,
    BMIResponse,
)
from backend.utils import auth
from backend.utils.datetime_ist import now_ist, today_ist
from backend.utils.firebase import getFirestoreClient
from backend.services import healthService

router = APIRouter()


def _extract_date_iso(row: dict) -> str | None:
    row_date = row.get("date")
    if isinstance(row_date, str) and len(row_date) >= 10:
        return row_date[:10]
    timestamp = row.get("timestamp")
    if isinstance(timestamp, str) and len(timestamp) >= 10:
        return timestamp[:10]
    return None


def _extract_number(value, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.match(r"([\d.]+)", value.strip())
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                return default
    return default


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
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")

        payload_data = payload.dict(exclude_none=True)
        entry_date = payload_data.get("date")
        if not entry_date:
            entry_date = today_ist()

        smartwatch_doc = {
            **payload_data,
            "date": entry_date,
            "timestamp": payload_data.get("timestamp", now_ist().isoformat()),
            "createdAt": now_ist().isoformat(),
        }

        db.collection("users").document(userId).collection("smartwatch").add(smartwatch_doc)
        return {"message": "Smartwatch data recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/smartwatch")
async def getSmartwatch(
    date: str | None = None,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Get smartwatch data, optionally filtered by date (YYYY-MM-DD)."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")

        collection_ref = db.collection("users").document(userId).collection("smartwatch")
        docs = collection_ref.stream()

        data = []
        for doc in docs:
            row = doc.to_dict()
            row["id"] = doc.id
            if date:
                row_date = row.get("date")
                if not row_date and isinstance(row.get("timestamp"), str):
                    row_date = row["timestamp"][:10]
                if row_date != date:
                    continue
            data.append(row)

        data.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
        return {"smartwatch": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/smartwatch/summary")
async def getSmartwatchSummary(
    date: str,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Get daily smartwatch summary (steps and calories burned) for a date."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")

        docs = (
            db.collection("users")
            .document(userId)
            .collection("smartwatch")
            .stream()
        )

        entries = []
        for doc in docs:
            row = doc.to_dict()
            row_date = row.get("date")
            if not row_date and isinstance(row.get("timestamp"), str):
                row_date = row["timestamp"][:10]
            if row_date == date:
                entries.append(row)

        # Wearables often send periodic snapshots; daily totals should use max values.
        total_steps = int(max((entry.get("steps", 0) or 0) for entry in entries) if entries else 0)
        total_burn = float(max((entry.get("caloriesBurned", 0) or 0) for entry in entries) if entries else 0)

        return {
            "date": date,
            "entryCount": len(entries),
            "totalSteps": total_steps,
            "totalCaloriesBurned": total_burn,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/glucose", status_code=status.HTTP_201_CREATED)
async def postGlucose(
    payload: GlucoseReading,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Add glucose reading."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")

        payload_data = payload.dict(exclude_none=True)
        glucose_doc = {
            **payload_data,
            "date": payload_data.get("date", today_ist()),
            "timestamp": payload_data.get("timestamp", now_ist().isoformat()),
            "createdAt": now_ist().isoformat(),
        }

        db.collection("users").document(userId).collection("glucose").add(glucose_doc)
        return {"message": "Glucose reading recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/glucose")
async def getGlucose(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get all glucose readings."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")

        docs = db.collection("users").document(userId).collection("glucose").stream()
        readings = []
        for doc in docs:
            row = doc.to_dict()
            row["id"] = doc.id
            readings.append(row)

        readings.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
        return {"glucose": readings, "count": len(readings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trends")
async def getWeeklyTrends(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get weekly trends (Mon-Sun) from Firestore; future days are zeroed."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")

        today = now_ist().date()
        week_start = today - timedelta(days=today.weekday())  # Monday
        week_days = [week_start + timedelta(days=offset) for offset in range(7)]
        week_set = {day.isoformat() for day in week_days}

        # Initialize all weekly series with zeros.
        sleep_by_day = {day.isoformat(): 0.0 for day in week_days}
        steps_by_day = {day.isoformat(): 0 for day in week_days}
        calories_intake_by_day = {day.isoformat(): 0.0 for day in week_days}
        calories_burned_by_day = {day.isoformat(): 0.0 for day in week_days}
        protein_by_day = {day.isoformat(): 0.0 for day in week_days}
        carbs_by_day = {day.isoformat(): 0.0 for day in week_days}
        fats_by_day = {day.isoformat(): 0.0 for day in week_days}
        glucose_values_by_day = {day.isoformat(): [] for day in week_days}

        meals_docs = db.collection("users").document(userId).collection("meals").stream()
        for doc in meals_docs:
            row = doc.to_dict()
            row_date = _extract_date_iso(row)
            if row_date not in week_set:
                continue
            if date.fromisoformat(row_date) > today:
                continue
            calories_intake_by_day[row_date] += _extract_number(row.get("calories"), 0.0)
            protein_by_day[row_date] += _extract_number(row.get("protein"), 0.0)
            carbs_by_day[row_date] += _extract_number(row.get("carbohydrates"), 0.0)
            fats_by_day[row_date] += _extract_number(row.get("totalFat"), 0.0)

        smartwatch_docs = db.collection("users").document(userId).collection("smartwatch").stream()
        for doc in smartwatch_docs:
            row = doc.to_dict()
            row_date = _extract_date_iso(row)
            if row_date not in week_set:
                continue
            if date.fromisoformat(row_date) > today:
                continue

            steps_value = int(_extract_number(row.get("steps"), 0.0))
            sleep_value = _extract_number(row.get("sleepDuration"), 0.0)
            burn_value = _extract_number(row.get("caloriesBurned"), 0.0)

            if steps_value > steps_by_day[row_date]:
                steps_by_day[row_date] = steps_value
            if sleep_value > sleep_by_day[row_date]:
                sleep_by_day[row_date] = sleep_value
            if burn_value > calories_burned_by_day[row_date]:
                calories_burned_by_day[row_date] = burn_value

        glucose_docs = db.collection("users").document(userId).collection("glucose").stream()
        for doc in glucose_docs:
            row = doc.to_dict()
            row_date = _extract_date_iso(row)
            if row_date not in week_set:
                continue
            if date.fromisoformat(row_date) > today:
                continue

            glucose_value = _extract_number(row.get("glucoseLevel", row.get("value")), 0.0)
            if glucose_value > 0:
                glucose_values_by_day[row_date].append(glucose_value)

        weekly_sleep = [round(sleep_by_day[day.isoformat()], 1) for day in week_days]
        weekly_steps = [int(steps_by_day[day.isoformat()]) for day in week_days]
        weekly_calories_intake = [round(calories_intake_by_day[day.isoformat()], 1) for day in week_days]
        weekly_calories_burned = [round(calories_burned_by_day[day.isoformat()], 1) for day in week_days]
        weekly_protein = [round(protein_by_day[day.isoformat()], 1) for day in week_days]
        weekly_carbs = [round(carbs_by_day[day.isoformat()], 1) for day in week_days]
        weekly_fats = [round(fats_by_day[day.isoformat()], 1) for day in week_days]
        weekly_blood_glucose = []
        for day in week_days:
            iso = day.isoformat()
            values = glucose_values_by_day[iso]
            weekly_blood_glucose.append(round(sum(values) / len(values), 1) if values else 0)

        return {
            "weekStart": week_start.isoformat(),
            "weekDays": [day.isoformat() for day in week_days],
            "weeklySleep": weekly_sleep,
            "weeklySteps": weekly_steps,
            "weeklyCaloriesIntake": weekly_calories_intake,
            "weeklyCaloriesBurned": weekly_calories_burned,
            "weeklyProtein": weekly_protein,
            "weeklyCarbs": weekly_carbs,
            "weeklyFats": weekly_fats,
            "weeklyBloodGlucose": weekly_blood_glucose,
        }
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

