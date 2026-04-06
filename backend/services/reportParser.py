"""Health report parser using Groq vision model."""

import uuid
import base64
import os
import json
import logging
import httpx
from fastapi import UploadFile
from typing import Dict, Any

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

SYSTEM_PROMPT = """You are a medical report analysis assistant.
Analyze the health report image and extract key information.
Respond ONLY with valid JSON, no additional text, using this exact structure:
{
  "status": "good | deficiency | superficiency",
  "summary": "brief 1-2 sentence summary",
  "details": "detailed findings",
  "nextCheckIn": "recommended follow-up timeframe e.g. 4 weeks",
  "nutrients": {
    "iron": "normal | low | high",
    "vitaminD": "normal | low | high",
    "vitaminB12": "normal | low | high",
    "calcium": "normal | low | high",
    "protein": "normal | low | high"
  },
  "metabolicMarkers": {
    "glucose": "normal | low | high",
    "cholesterol": "normal | low | high | slightly elevated",
    "ldl": "normal | low | high",
    "hdl": "normal | low | high"
  }
}
Rules:
- status is "deficiency" if any nutrient/marker is low
- status is "superficiency" if any nutrient/marker is high or elevated
- status is "good" if all values are normal
- Extract actual values from the report if visible, otherwise infer from context
- If the image is not a health report, return status "good" with summary "Unable to analyze image"
"""


async def parseReport(file: UploadFile) -> Dict[str, Any]:
    """Parse uploaded health report image using Groq vision model."""
    try:
        content = await file.read()
        fileSize = len(content)
        logger.info(f"Parsing report: {file.filename} ({fileSize} bytes)")

        # Use Groq vision if API key available
        if GROQ_API_KEY:
            logger.info(f"Groq API key found, attempting vision analysis for {file.filename}")
            result = await _parseWithGroq(content, file.content_type or "image/jpeg")
            if result:
                result["scanId"] = str(uuid.uuid4())
                result["filename"] = file.filename
                result["fileSize"] = fileSize
                result["contentType"] = file.content_type
                # normalize nutrients key name
                if "metabolic_markers" not in result and "metabolicMarkers" in result:
                    result["metabolic_markers"] = result.pop("metabolicMarkers")
                return result

        # Fallback to mock if no API key
        logger.warning("GROQ_API_KEY not set — using mock parser")
        return _mockParse(file.filename, fileSize, file.content_type)

    except Exception as e:
        logger.error(f"Report parsing error: {str(e)}")
        raise


async def _parseWithGroq(imageBytes: bytes, contentType: str) -> Dict[str, Any]:
    """Send image to Groq vision model and parse response."""
    try:
        b64Image = base64.b64encode(imageBytes).decode("utf-8")
        dataUrl = f"data:{contentType};base64,{b64Image}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": SYSTEM_PROMPT,
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": dataUrl},
                                },
                            ],
                        }
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1000,
                },
            )

            if response.status_code != 200:
                logger.error(f"Groq API error: {response.status_code} {response.text}")
                return None

            data = response.json()
            rawText = data["choices"][0]["message"]["content"].strip()

            # Strip markdown fences if present
            if "```json" in rawText:
                rawText = rawText.split("```json")[1].split("```")[0].strip()
            elif "```" in rawText:
                rawText = rawText.split("```")[1].split("```")[0].strip()

            parsed = json.loads(rawText)
            logger.info("Groq vision model parsed report successfully")
            return parsed

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Groq JSON response: {e}")
        return None
    except Exception as e:
        logger.error(f"Groq API call failed: {e}", exc_info=True)
        return None


def _mockParse(filename: str, fileSize: int, contentType: str) -> Dict[str, Any]:
    """Fallback mock parser when Groq is unavailable."""
    return {
        "scanId": str(uuid.uuid4()),
        "filename": filename,
        "fileSize": fileSize,
        "contentType": contentType,
        "status": "deficiency",
        "summary": "Report shows some nutritional deficiencies (mock result).",
        "details": "Iron and Vitamin B12 levels are low. Consider supplementation.",
        "nextCheckIn": "4 weeks",
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