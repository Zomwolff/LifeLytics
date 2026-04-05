"""Chatbot service for health-related conversations.

Integrates with LLM for intelligent, context-aware responses.
Includes fallback to rule-based responses if LLM is unavailable.

Features:
- Logging of chatbot interactions
- Performance tracking
- LLM status reporting (llm_used, model_used)
- User context awareness
- Fallback responses with error details
"""

from typing import Dict, Any
import logging

from backend import database
from backend.services.llmService import getLLMService
from backend.utils.logger import getLogger, timeOperation, llmLogger

logger = getLogger(__name__)


async def respond(message: str, userId: str) -> Dict[str, Any]:
    """Generate chatbot response based on user message and health context.

    Process:
    1. Get user health data for context
    2. Call LLM service with message + context
    3. Return response with LLM metadata (llm_used, model_used, status)

    Args:
        message: User's chat message
        userId: User ID for context retrieval and logging

    Returns:
        Dict with:
        - response: str (chatbot response)
        - llm_used: bool
        - model_used: str or None
        - llm_status: "success" or other status
    """
    with timeOperation(f"Chatbot response for user {userId}", logger) as timer:
        try:
            if _isGreetingMessage(message):
                greeting = _buildGreetingResponse(userId)
                return {
                    "response": greeting,
                    "llm_used": False,
                    "model_used": None,
                    "llm_status": "greeting",
                }

            # Get user context for health awareness
            userContext = database.getAllUserData(userId)
            if not userContext:
                userContext = {}

            # Prepare health metrics
            healthMetrics = _extractHealthMetrics(userContext)

            # Log the incoming message
            msgPreview = message[:50] + "..." if len(message) > 50 else message
            logger.info(f"Processing chat message for user {userId}: {msgPreview}")

            # Use LLM service (returns dict with response + metadata)
            llmService = getLLMService()
            llmResponse = await llmService.generateChatResponse(
                message, {"metrics": healthMetrics, "context": userContext}, userId=userId
            )

            # Log LLM usage
            if llmResponse.get("llm_used"):
                llmLogger.info(
                    f"Chat response from {llmResponse.get('model_used')} for user {userId}"
                )
            else:
                status = llmResponse.get("llm_status", "unknown")
                llmLogger.warning(f"Chat fallback (LLM {status}) for user {userId}")

            responseText = _ensureChatResponse(llmResponse.get("response"), message)
            llmResponse["response"] = responseText

            logger.info(f"Generated chat response for user {userId} in {timer.elapsed:.2f}s")
            return llmResponse

        except Exception as e:
            logger.error(f"Error generating chat response for user {userId}: {str(e)}")
            # Return fallback with error information
            return {
                "response": _mockChatFallback(message),
                "llm_used": False,
                "model_used": None,
                "llm_status": "error",
                "llm_error": str(e),
            }


def _extractHealthMetrics(userContext: Dict[str, Any]) -> Dict[str, Any]:
    """Extract health metrics from user context for LLM awareness.

    Args:
        userContext: User's complete health data

    Returns:
        Formatted metrics dictionary
    """
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
    """Provide mock fallback response for chat.
    
    Args:
        message: User's message
        
    Returns:
        Generic fallback response
    """
    keyword = message.lower()
    if "neck" in keyword or "neck pain" in keyword or "stiff neck" in keyword:
        return (
            "Neck pain is often caused by posture, muscle strain, or sleeping position. "
            "Try gentle neck stretches, keep your screen at eye level, and avoid sudden twisting. "
            "If you have numbness, weakness, severe pain, fever, or pain after an injury, please see a doctor promptly."
        )
    if "bmi" in keyword:
        return "You can check your BMI at the /health/bmi endpoint. BMI helps assess if you're at a healthy weight for your height."
    elif "glucose" in keyword or "blood sugar" in keyword:
        return "Glucose monitoring is important for managing diabetes risk. Regular readings help identify patterns and trends."
    elif "exercise" in keyword or "workout" in keyword:
        return "Regular exercise is crucial for overall health. Aim for at least 150 minutes of moderate activity per week."
    elif "nutrition" in keyword or "diet" in keyword:
        return "A balanced diet with fruits, vegetables, whole grains, and lean proteins supports optimal health."
    else:
        return (
            "I can help with health-related questions. Try asking about BMI, glucose, exercise, nutrition, or symptoms like neck pain. "
            "If you describe the problem, I can suggest safe next steps and when to seek medical care."
        )


def _isGreetingMessage(message: str) -> bool:
    """Detect simple greeting messages that should get a greeting back."""
    normalized = " ".join(message.lower().strip().split())
    if not normalized:
        return False

    greeting_patterns = [
        r"^(hi|hello|hey|hii|yo|hola|namaste|good morning|good afternoon|good evening)( there)?[!.?]*$",
        r"^(hi|hello|hey|hii|yo|hola|namaste|good morning|good afternoon|good evening)[,.!\s]*$",
        r"^(hi|hello|hey)[\s,!.?]*life(lytics)?[\s,!.?]*$",
    ]

    import re

    return any(re.match(pattern, normalized) for pattern in greeting_patterns)


def _buildGreetingResponse(userId: str) -> str:
    """Build a simple greeting response."""
    session = database.getAllUserData(userId) or {}
    name = session.get("name")
    if name:
        return f"Hi {name}, how can I help you today?"
    return "Hi, how can I help you today?"


def _ensureChatResponse(response: Any, message: str) -> str:
    """Normalize chatbot output and guarantee a useful fallback."""
    if isinstance(response, str):
        cleaned = response.strip()
        if cleaned:
            return cleaned

    return _mockChatFallback(message)

