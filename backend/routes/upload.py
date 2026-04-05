"""Document upload routes.

Endpoints:
- POST /upload/report - Upload health report for parsing
- GET /upload/reports - Get all uploaded reports
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from backend.utils import auth
from backend.services import reportParser
from backend import database

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
        database.addReport(userId, parsed)
        return {
            "message": "Report parsed and stored",
            "filename": file.filename,
            "nutrients": parsed.get("nutrients"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports")
async def getReports(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get all uploaded reports."""
    try:
        reports = database.getReports(userId)
        return {"reports": reports, "count": len(reports)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

