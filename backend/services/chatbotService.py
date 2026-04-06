"""Chatbot service with persistent history and prescription context."""

from typing import Dict, Any, List
import logging

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

            # Load all context in parallel-ish
            user_profile = await firestore_db.getUserProfile(userId) or {}
            health_logs = await firestore_db.getHealthLogs(userId)
            glucose = await firestore_db.getCollectionDocs(userId, "glucose")
            smartwatch = await firestore_db.getCollectionDocs(userId, "smartwatch")
            chat_history = await firestore_db.getChatHistory(userId, limit=20)
            reports = await firestore_db.getReports(userId)

            # Save user message first
            await firestore_db.saveChatMessage(userId, "user", message)

            userContext = {
                **user_profile,
                "health_logs": health_logs,
                "glucose": glucose,
                "smartwatch": smartwatch,
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

            # Save assistant response
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
    """Build a text summary of prescription/report history for LLM context."""
    if not reports:
        return "No prescription or health report history available."

    lines = ["Recent health reports:"]
    for i, report in enumerate(reports[:5]):  # last 5 reports
        status = report.get("status", "unknown")
        summary = report.get("summary", "")
        filename = report.get("filename", f"Report {i+1}")
        timestamp = report.get("timestamp", "")[:10] if report.get("timestamp") else ""
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
    """Convert Firestore chat history to LLM message format."""
    messages = []
    for msg in chat_history:
        role = msg.get("role", "user")
        text = msg.get("text", "")
        if role in ("user", "assistant") and text:
            messages.append({"role": role, "content": text})
    return messages


def _extractHealthMetrics(userContext: Dict[str, Any]) -> Dict[str, Any]:
    height = userContext.get("height", 0)
    weight = userContext.get("weight", 0)
    bmi = None
    if height and weight and height > 0:
        bmi = round(weight / (height * height), 1)
    return {
        "height": height,
        "weight": weight,
        "bmi": bmi,
        "avgSleep": 0,
        "avgSteps": 0,
        "avgGlucose": 0,
        "avgHeartRate": 0,
        "dataPoints": len(userContext.get("health_logs", [])),
    }


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
        if cleaned:
            return cleaned
    return _mockChatFallback(message)