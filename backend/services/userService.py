"""User profile service — Firestore CRUD."""
from typing import Optional, Dict, Any
from backend.utils.firebase import getFirestoreClient
from backend.utils.logger import getLogger

logger = getLogger(__name__)

ALLOWED_FIELDS = {"name", "age", "gender", "heightCm", "weightKg", "targetSteps", "caloriesTarget"}


async def createProfile(uid: str, name: str, email: str) -> Dict[str, Any]:
    db = getFirestoreClient()
    profile = {
        "id": uid,
        "name": name,
        "email": email,
        "age": None,
        "gender": None,
        "heightCm": None,
        "weightKg": None,
        "targetSteps": None,
        "caloriesTarget": None,
    }
    db.collection("users").document(uid).set(profile)
    logger.info(f"Created profile for {uid}")
    return profile


async def getProfile(uid: str) -> Optional[Dict[str, Any]]:
    db = getFirestoreClient()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = uid
    return data


async def updateField(uid: str, field: str, value: Any) -> Dict[str, Any]:
    if field not in ALLOWED_FIELDS:
        raise ValueError(f"Field '{field}' is not allowed.")

    if field == "name":
        value = str(value).strip()
        if not value:
            raise ValueError("Name is required.")
    elif field == "age":
        value = float(value)
        if not (1 <= value <= 120):
            raise ValueError("Enter a valid age.")
    elif field == "gender":
        allowed = ["Male", "Female", "Other", "Prefer not to say"]
        if value not in allowed:
            raise ValueError("Select a valid gender.")
    elif field == "heightCm":
        value = float(value)
        if not (80 <= value <= 260):
            raise ValueError("Enter a valid height in cm.")
    elif field == "weightKg":
        value = float(value)
        if not (20 <= value <= 400):
            raise ValueError("Enter a valid weight in kg.")
    elif field == "targetSteps":
        value = int(value)
        if not (1000 <= value <= 50000):
            raise ValueError("Enter valid target steps (1000-50000).")
    elif field == "caloriesTarget":
        value = int(value)
        if not (1200 <= value <= 5000):
            raise ValueError("Enter valid daily calories target (1200-5000).")

    db = getFirestoreClient()
    db.collection("users").document(uid).update({field: value})
    return await getProfile(uid)


async def saveMetrics(
    uid: str,
    heightCm: float,
    weightKg: float,
    targetSteps: int,
    caloriesTarget: int,
) -> Dict[str, Any]:
    if not (80 <= heightCm <= 260):
        raise ValueError("Enter a valid height in cm.")
    if not (20 <= weightKg <= 400):
        raise ValueError("Enter a valid weight in kg.")
    if not (1000 <= targetSteps <= 50000):
        raise ValueError("Enter valid target steps (1000-50000).")
    if not (1200 <= caloriesTarget <= 5000):
        raise ValueError("Enter valid daily calories target (1200-5000).")

    db = getFirestoreClient()
    db.collection("users").document(uid).update({
        "heightCm": round(heightCm, 1),
        "weightKg": round(weightKg, 1),
        "targetSteps": targetSteps,
        "caloriesTarget": caloriesTarget,
    })
    return await getProfile(uid)