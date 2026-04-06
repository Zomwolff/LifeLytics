"""Document upload routes.

Endpoints:
- POST /upload/report - Upload health report for parsing
- GET /upload/reports - Get all uploaded reports
- POST /upload/follow-up - Request follow-up guidance for report status
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from backend.utils import auth
from backend.utils import firestore_db
from backend.services import reportParser


class FollowUpRequest(BaseModel):
    scanId: Optional[str] = None
    currentStatus: str
    followUpHistory: List[str] = []

router = APIRouter()


@router.post("/report", status_code=201)
async def uploadReport(
    file: UploadFile = File(...),
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Upload and parse a health report.

    Supports PDF and image formats (future OCR integration).
    Extracts nutrient data and stores in user profile.
    """
    try:
        parsed = await reportParser.parseReport(file)
        report_id = await firestore_db.saveReport(userId, parsed)
        if not report_id:
            raise HTTPException(status_code=500, detail="Failed to persist report")
        return {
            "scanId": parsed.get("scanId") or report_id,
            "filename": file.filename,
            "status": parsed.get("status", "normal"),
            "summary": parsed.get("summary", "Report analyzed successfully."),
            "details": parsed.get("details", "No additional findings at this time."),
            "nextCheckIn": parsed.get("nextCheckIn"),
            "nutrients": parsed.get("nutrients"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports")
async def getReports(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get all uploaded reports."""
    try:
        reports = await firestore_db.getReports(userId)
        return {"reports": reports, "count": len(reports)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/follow-up", status_code=200)
async def getFollowUp(
    payload: FollowUpRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    try:
        currentStatus = payload.currentStatus.lower()
        followUpHistory = payload.followUpHistory or []

        if currentStatus == "deficiency":
            suggestions = [
                "Increase iron-rich foods: red meat, spinach, lentils, chickpeas.",
                "Supplement Vitamin B12 with dietary sources or supplements.",
                "Consider a personalized nutrition plan with a dietitian.",
                "Recheck levels in 4 weeks to monitor improvements.",
            ]
        elif currentStatus == "superficiency":
            suggestions = [
                "Moderate protein intake but maintain balanced diet.",
                "Reduce processed foods and saturated fats.",
                "Increase physical activity to 150 minutes per week.",
                "Recheck cholesterol and metabolic markers in 6 weeks.",
            ]
        else:
            suggestions = [
                "Continue current healthy lifestyle habits.",
                "Maintain regular health check-ups every 3 months.",
                "Stay consistent with exercise and balanced nutrition.",
            ]

        nextSuggestion = next(
            (s for s in suggestions if s not in followUpHistory),
            "Continue monitoring your health. Schedule a follow-up in 4 weeks."
        )

        updatedStatus = currentStatus
        if currentStatus == "deficiency" and len(followUpHistory) >= 2:
            updatedStatus = "normal"
            summary = "Good progress. Continue supplementation and dietary adjustments."
        else:
            summary = "Follow-up plan created based on your current health status."

        # Persist follow-up to Firestore if scanId provided
        if payload.scanId:
            try:
                db = firestore_db.getFirestoreClient()
                db.collection("reports").document(payload.scanId).update({
                    "followUpHistory": followUpHistory + [nextSuggestion],
                    "status": updatedStatus,
                })
            except Exception as e:
                logger.warning(f"Could not update report follow-up: {e}")

        return {
            "followUpMessage": nextSuggestion,
            "status": updatedStatus,
            "summary": summary,
            "details": "Monitor your health metrics regularly.",
            "nextCheckIn": "4 weeks",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))