"""Chatbot service with persistent history and prescription context."""

from typing import Dict, Any, List
import logging
import json

from backend.utils import firestore_db
from backend.services.llmService import getLLMService
from backend.utils.logger import getLogger, timeOperation, llmLogger

logger = getLogger(__name__)


async def respond(message: str, userId: str) -> Dict[str, Any]:
    with timeOperation(f"Chatbot response for user {userId}", logger) as timer:
        try:
            if _isGreetingMessage(message):
                greeting = await _buildGreetingResponse(userId)
                await firestore_db.saveChatMessage(userId, "user", message)
                await firestore_db.saveChatMessage(userId, "assistant", greeting)
                return {
                    "response": greeting,
                    "llm_used": False,
                    "model_used": None,
                    "llm_status": "greeting",
                }

            user_profile = await firestore_db.getUserProfile(userId) or {}
            health_logs = await firestore_db.getHealthLogs(userId)
            glucose = await firestore_db.getCollectionDocs(userId, "glucose")
            smartwatch = await firestore_db.getCollectionDocs(userId, "smartwatch")
            meals = await firestore_db.getCollectionDocs(userId, "meals")
            trend_context = await firestore_db.getLatestTrendContext(userId) or {}
            userContext = {
                **user_profile,
                "health_logs": health_logs,
                "glucose": glucose,
                "smartwatch": smartwatch,
                "meals": meals,
                "trend_context": trend_context,
            }

            healthMetrics = _extractHealthMetrics(userContext)
            prescriptionContext = _buildPrescriptionContext(reports)
            historyContext = _buildHistoryContext(chat_history)

            msgPreview = message[:50] + "..." if len(message) > 50 else message
            logger.info(f"Processing chat for user {userId}: {msgPreview}")

            llmService = getLLMService()
            llmResponse = await llmService.generateChatResponse(
                message,
                {
                    "metrics": healthMetrics,
                    "context": userContext,
                    "prescriptionContext": prescriptionContext,
                    "chatHistory": historyContext,
                },
                userId=userId,
            )

            if llmResponse.get("llm_used"):
                llmLogger.info(f"Chat response from {llmResponse.get('model_used')} for {userId}")
            else:
                llmLogger.warning(f"Chat fallback (LLM {llmResponse.get('llm_status')}) for {userId}")

            responseText = _ensureChatResponse(llmResponse.get("response"), message)
            llmResponse["response"] = responseText

            await firestore_db.saveChatMessage(userId, "assistant", responseText)

            logger.info(f"Chat response for {userId} in {timer.elapsed:.2f}s")
            return llmResponse

        except Exception as e:
            logger.error(f"Error in chatbot for {userId}: {str(e)}")
            fallback = _mockChatFallback(message)
            return {
                "response": fallback,
                "llm_used": False,
                "model_used": None,
                "llm_status": "error",
                "llm_error": str(e),
            }


def _buildPrescriptionContext(reports: List[Dict[str, Any]]) -> str:
    if not reports:
        return "No prescription or health report history available."

    lines = ["Recent health reports:"]
    for i, report in enumerate(reports[:5]):
        status = report.get("status", "unknown")
        summary = report.get("summary", "")
        filename = report.get("filename", f"Report {i+1}")
        timestamp = report.get("uploadedAt", "")[:10] if report.get("uploadedAt") else ""
        nutrients = report.get("nutrients", {})
        markers = report.get("metabolicMarkers", report.get("metabolic_markers", {}))

        lines.append(f"\n- {filename} ({timestamp}): Status={status}")
        if summary:
            lines.append(f"  Summary: {summary}")
        if nutrients:
            low = [k for k, v in nutrients.items() if str(v).lower() in ["low", "deficient"]]
            high = [k for k, v in nutrients.items() if str(v).lower() in ["high", "elevated", "excess"]]
            if low:
                lines.append(f"  Low nutrients: {', '.join(low)}")
            if high:
                lines.append(f"  High nutrients: {', '.join(high)}")
        if markers:
            abnormal = [k for k, v in markers.items() if str(v).lower() != "normal"]
            if abnormal:
                lines.append(f"  Abnormal markers: {', '.join(abnormal)}")

    return "\n".join(lines)


def _buildHistoryContext(chat_history: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    messages = []
    for msg in chat_history:
        role = msg.get("role", "user")
        text = msg.get("text", "")
        if role in ("user", "assistant") and text:
            messages.append({"role": role, "content": text})
    return messages


    Returns:
        Formatted metrics dictionary
    
    height_cm = _to_number(userContext.get("heightCm"), 0)
    height = _to_number(userContext.get("height"), 0)
    if height_cm > 0:
        height = round(height_cm / 100.0, 4)

    weight = _to_number(userContext.get("weightKg"), 0)
    if weight <= 0:
        weight = _to_number(userContext.get("weight"), 0)

    bmi = round(weight / (height * height), 1) if height > 0 and weight > 0 else None

    trend_context = userContext.get("trend_context") or {}

    trend_sleep = _numeric_series(trend_context.get("sleep") or trend_context.get("weeklySleep"))
    trend_steps = _numeric_series(trend_context.get("steps") or trend_context.get("weeklySteps"))
    trend_glucose = _numeric_series(trend_context.get("glucose") or trend_context.get("weeklyBloodGlucose"))
    trend_heart = _numeric_series(trend_context.get("heart_rate") or trend_context.get("weeklyHeartRate"))

    smartwatch = userContext.get("smartwatch") or []
    health_logs = userContext.get("health_logs") or []
    glucose_rows = userContext.get("glucose") or []

    sleep_values = [
        max(
            _to_number(row.get("sleepDuration"), 0),
            _to_number(row.get("sleep"), 0),
        )
        for row in [*smartwatch, *health_logs]
        if max(_to_number(row.get("sleepDuration"), 0), _to_number(row.get("sleep"), 0)) > 0
    ] or trend_sleep

    steps_values = [
        max(
            _to_number(row.get("steps"), 0),
            _to_number(row.get("stepCount"), 0),
        )
        for row in [*smartwatch, *health_logs]
        if max(_to_number(row.get("steps"), 0), _to_number(row.get("stepCount"), 0)) > 0
    ] or trend_steps

    glucose_values = [
        value
        for value in [
            *[
                _pick_first_number(row, ["glucoseLevel", "value", "glucose"])
                for row in glucose_rows
            ],
            *[
                _pick_first_number(row, ["glucose", "glucoseLevel", "value"])
                for row in health_logs
            ],
        ]
        if value > 0
    ] or trend_glucose

    heart_rate_values = [
        value
        for value in [
            *[_pick_first_number(row, ["heartRate", "avgHeartRate"]) for row in smartwatch],
            *[_pick_first_number(row, ["heartRate", "avgHeartRate"]) for row in health_logs],
        ]
        if value > 0
    ] or trend_heart

    meals = userContext.get("meals") or []
    calories_values = [
        _pick_first_number(row, ["calories"]) for row in meals
    ]
    calories_values = [value for value in calories_values if value > 0]

    return {
        "height": height,
        "weight": weight,
        "bmi": bmi,
        "avgSleep": _average(sleep_values),
        "avgSteps": int(round(_average(steps_values))) if steps_values else 0,
        "avgGlucose": _average(glucose_values),
        "avgHeartRate": _average(heart_rate_values),
        "avgCaloriesIntake": _average(calories_values),
        "dataPoints": len(health_logs) + len(glucose_rows) + len(smartwatch) + len(meals),
    }


def _to_number(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return default
        parsed = []
        chunk = ""
        for char in text:
            if char.isdigit() or char == ".":
                chunk += char
            elif chunk:
                break
        if chunk:
            try:
                return float(chunk)
            except ValueError:
                return default
    return default


def _pick_first_number(row: Dict[str, Any], keys: list[str], default: float = 0.0) -> float:
    for key in keys:
        value = _to_number(row.get(key), 0.0)
        if value > 0:
            return value
    return default


def _numeric_series(values: Any) -> list[float]:
    if not isinstance(values, list):
        return []
    output: list[float] = []
    for value in values:
        parsed = _to_number(value, 0.0)
        if parsed > 0:
            output.append(parsed)
    return output


def _average(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


def _mockChatFallback(message: str) -> str:
    keyword = message.lower()
    if "neck" in keyword:
        return "Neck pain is often caused by posture or muscle strain. Try gentle stretches and keep your screen at eye level. See a doctor if you have numbness or severe pain."
    if "bmi" in keyword:
        return "BMI helps assess if you're at a healthy weight for your height."
    if "glucose" in keyword or "blood sugar" in keyword:
        return "Glucose monitoring is important for managing diabetes risk."
    if "exercise" in keyword or "workout" in keyword:
        return "Aim for at least 150 minutes of moderate activity per week."
    if "nutrition" in keyword or "diet" in keyword:
        return "A balanced diet with fruits, vegetables, whole grains, and lean proteins supports optimal health."
    return "I can help with health-related questions about BMI, glucose, exercise, nutrition, or your reports."


def _isGreetingMessage(message: str) -> bool:
    import re
    normalized = " ".join(message.lower().strip().split())
    if not normalized:
        return False
    patterns = [
        r"^(hi|hello|hey|hii|yo|hola|namaste|good morning|good afternoon|good evening)( there)?[!.?]*$",
        r"^(hi|hello|hey|hii|yo|hola|namaste|good morning|good afternoon|good evening)[,.!\s]*$",
        r"^(hi|hello|hey)[\s,!.?]*life(lytics)?[\s,!.?]*$",
    ]
    return any(re.match(p, normalized) for p in patterns)


async def _buildGreetingResponse(userId: str) -> str:
    session = await firestore_db.getUserProfile(userId) or {}
    name = session.get("name")
    return f"Hi {name}, how can I help you today?" if name else "Hi, how can I help you today?"


def _ensureChatResponse(response: Any, message: str) -> str:
    if isinstance(response, str):
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()

        # Some models still return JSON-like payloads for chat; extract plain text safely.
        if cleaned.startswith("{") and cleaned.endswith("}"):
            try:
                parsed = json.loads(cleaned)
                for key in ["response", "answer", "message", "content", "text"]:
                    candidate = parsed.get(key)
                    if isinstance(candidate, str) and candidate.strip():
                        return candidate.strip()
            except Exception:
                pass

        if cleaned:
            return cleaned
    return _mockChatFallback(message)