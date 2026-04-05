"""Health report parser service.

Currently uses mock parsing.
Future: Integrate OCR (Tesseract) and real PDF parsing (pdfplumber).
"""

from fastapi import UploadFile
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


async def parseReport(file: UploadFile) -> Dict[str, Any]:
    """Parse uploaded health report (currently mock).

    Process:
    1. Read file content
    2. Extract nutrient data (mock for now)
    3. Return structured data

    Future integration:
    - Use pdfplumber for PDF extraction
    - Use Tesseract OCR for image text extraction
    - Parse medical report format and extract key values

    Args:
        file: Uploaded file from UploadFile

    Returns:
        Structured nutrient data
    """
    try:
        content = await file.read()
        fileSize = len(content)

        logger.info(f"Parsing report: {file.filename} ({fileSize} bytes)")

        # Mock nutrient analysis
        # Future: Replace with real parsing logic
        parsed = {
            "filename": file.filename,
            "fileSize": fileSize,
            "contentType": file.content_type,
            "nutrients": {
                "iron": "low",
                "vitaminD": "normal",
                "vitaminB12": "low",
                "calcium": "normal",
                "protein": "high",
            },
            "metabolic_markers": {
                "glucose": "normal",
                "cholesterol": "slightly elevated",
                "ldl": "normal",
                "hdl": "normal",
            },
        }

        return parsed

    except Exception as e:
        logger.error(f"Report parsing error: {str(e)}")
        raise

