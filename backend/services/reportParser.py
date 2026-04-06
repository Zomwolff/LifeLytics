"""Health report parser service.

Currently uses mock parsing.
Future: Integrate OCR (Tesseract) and real PDF parsing (pdfplumber).
"""

from fastapi import UploadFile
from typing import Dict, Any
import logging
import uuid

logger = logging.getLogger(__name__)


async def parseReport(file: UploadFile) -> Dict[str, Any]:
    """Parse uploaded health report (currently mock).

    Process:
    1. Read file content
    2. Extract nutrient data (mock for now)
    3. Determine overall status based on findings
    4. Return structured data with status, summary, and recommendations

    Future integration:
    - Use pdfplumber for PDF extraction
    - Use Tesseract OCR for image text extraction
    - Parse medical report format and extract key values

    Args:
        file: Uploaded file from UploadFile

    Returns:
        Structured report data with status and insights
    """
    try:
        content = await file.read()
        fileSize = len(content)

        logger.info(f"Parsing report: {file.filename} ({fileSize} bytes)")

        # Mock nutrient and metabolic analysis
        # Future: Replace with real parsing logic
        nutrients = {
            "iron": "low",
            "vitaminD": "normal",
            "vitaminB12": "low",
            "calcium": "normal",
            "protein": "high",
        }

        metabolic_markers = {
            "glucose": "normal",
            "cholesterol": "slightly elevated",
            "ldl": "normal",
            "hdl": "normal",
        }

        # Determine overall status based on findings
        has_deficiency = any(
            v.lower() in ["low", "deficient", "deficiency"]
            for v in list(nutrients.values()) + list(metabolic_markers.values())
        )
        has_excess = any(
            v.lower() in ["high", "elevated", "excess", "superficiency"]
            for v in list(nutrients.values()) + list(metabolic_markers.values())
        )

        if has_deficiency:
            overall_status = "deficiency"
            summary = "Report shows some nutritional deficiencies that should be addressed."
            details = "Key findings: Iron, Vitamin B12 levels are low. Consider supplementation and dietary adjustments."
        elif has_excess:
            overall_status = "superficiency"
            summary = "Report shows some elevated levels that should be monitored."
            details = "Key findings: Cholesterol and protein levels are elevated. Monitor and adjust diet as recommended."
        else:
            overall_status = "good"
            summary = "Your health markers look normal and balanced."
            details = "All key metrics are within healthy ranges. Continue your current health practices."

        parsed = {
            "scanId": str(uuid.uuid4()),
            "filename": file.filename,
            "fileSize": fileSize,
            "contentType": file.content_type,
            "status": overall_status,
            "summary": summary,
            "details": details,
            "nextCheckIn": "4 weeks",
            "nutrients": nutrients,
            "metabolic_markers": metabolic_markers,
        }

        return parsed

    except Exception as e:
        logger.error(f"Report parsing error: {str(e)}")
        raise

