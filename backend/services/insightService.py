"""Insight generation service.

Combines rule-based analysis with LLM integration for advanced health insights.
Uses caching to minimize API calls and logging to track performance.
Reads data from Firestore for persistent storage.

Features:
- Rate limiting to prevent excessive LLM calls
- Caching of recent insights (30 min TTL)
- Logging of performance metrics with timings
- LLM with fallback models (never silently fails)
- Transparent LLM status reporting (llm_used, model_used fields)
- Rules-based analysis if LLM unavailable
"""

from typing import Dict, Any, Optional
import logging
import time

from backend.utils import firestore_db
from backend.services import healthService
from backend.services.llmService import getLLMService
from backend.utils.logger import getLogger, timeOperation, llmLogger
from backend.utils.rate_limiter import getInsightRateLimiter
from backend.utils.cache import getCache

logger = getLogger(__name__)
rateLimiter = getInsightRateLimiter()
cache = getCache()


async def generateInsights(userId: str) -> Dict[str, Any]:
    """Generate insights using rule-based analysis + LLM enhancement with caching.

    Process:
    1. Check cache for recent insights
    2. Check rate limit
    3. Generate rule-based insights from Firestore health logs
    4. Attempt LLM enhancement (with fallback models)
    5. Cache results
    6. Return insights with llm_used and model_used fields

    Args:
        userId: User ID for accessing Firestore data

    Returns:
        Insights dict with:
        - insights, risks, recommendations, healthScore
        - llm_used: bool (True if LLM successful)
        - model_used: str or None (model name if LLM successful)
        - llm_status: "success", "failed", "rate_limited", etc.
    """
    # Check cache first
    cacheKey = f"insights_{userId}"
    cachedInsights = cache.get(cacheKey)
    if cachedInsights:
        logger.info(f"Returning cached insights for user {userId}")
        return cachedInsights

    # Check rate limit
    allowed, stats = rateLimiter.isAllowed(userId)
    if not allowed:
        logger.warning(
            f"Insight generation rate limited for user {userId}. "
            f"Reset in {stats['resetIn']}s"
        )
        # Generate rule-based as fallback but indicate rate limit
        ruleBasedInsights = await _generateRuleBasedInsights(userId)
        ruleBasedInsights["llm_status"] = "rate_limited"
        ruleBasedInsights["llm_used"] = False
        return ruleBasedInsights

    with timeOperation(f"Insight generation for user {userId}", logger) as timer:
        try:
            # Generate rule-based insights from Firestore data
            logger.info(f"Generating rule-based insights for user {userId}")
            ruleBasedInsights = await _generateRuleBasedInsights(userId)

            # Attempt LLM enhancement
            logger.info(f"Attempting LLM enhancement for user {userId}")
            llmService = getLLMService()
            enhancedInsights = await llmService.generateInsights(
                ruleBasedInsights, userId=userId
            )

            # Log LLM usage
            if enhancedInsights.get("llm_used"):
                llmLogger.info(
                    f"LLM SUCCESS for user {userId} using model {enhancedInsights.get('model_used')}"
                )
            else:
                llmStatus = enhancedInsights.get("llm_status", "unknown")
                llmError = enhancedInsights.get("llm_error", "")
                llmLogger.warning(
                    f"LLM FAILED for user {userId} - Status: {llmStatus}, Error: {llmError}"
                )

            # Cache the result for 30 minutes
            cache.set(cacheKey, enhancedInsights)

            logger.info(
                f"Generated insights for user {userId} in {timer.elapsed:.2f}s "
                f"(LLM: {enhancedInsights.get('llm_used')})"
            )

            return enhancedInsights

        except Exception as e:
            logger.error(f"Error generating insights for user {userId}: {str(e)}")
            # Return rule-based as error fallback
            ruleBasedInsights = await _generateRuleBasedInsights(userId)
            ruleBasedInsights["llm_status"] = "error"
            ruleBasedInsights["llm_error"] = str(e)
            ruleBasedInsights["llm_used"] = False
            return ruleBasedInsights


async def _generateRuleBasedInsights(userId: str) -> Dict[str, Any]:
    """Generate rule-based health insights from Firestore data."""
    # Get user profile from Firestore
    user_profile = await firestore_db.getUserProfile(userId)
    if not user_profile:
        logger.error(f"User {userId} not found in Firestore")
        return {
            "insights": [],
            "risks": ["User data not found"],
            "recommendations": [],
            "health_score": 0,
            "metrics": {},
        }

    height = user_profile.get("height")
    weight = user_profile.get("weight")

    # Get health logs from Firestore
    health_logs = await firestore_db.getHealthLogs(userId)

    # Calculate metrics from health logs
    bmi = _calculateBmiFromMetrics(height, weight)
    avgSleep = _calculateAverage(health_logs, "sleep")
    avgSteps = _calculateAverage(health_logs, "steps")
    avgGlucose = _calculateAverage(health_logs, "glucose")
    avgHeartRate = _calculateAverage(health_logs, "heartRate")

    # Identify risks
    risks = []

    if bmi:
        if bmi >= 30:
            risks.append("Obesity (BMI >= 30)")
        elif bmi >= 25:
            risks.append("Overweight (BMI 25-29.9)")
        elif bmi < 18.5:
            risks.append("Underweight (BMI < 18.5)")

    if avgGlucose and avgGlucose > 126:
        risks.append("High average glucose (126+ mg/dL)")

    if avgSteps and avgSteps < 5000:
        risks.append("Low daily activity (less than 5000 steps)")

    if avgSleep and (avgSleep < 6 or avgSleep > 9):
        risks.append("Irregular sleep patterns")

    # Generate recommendations
    recommendations = []

    if bmi and bmi >= 25:
        recommendations.append("Consider weight management through diet and exercise")

    if avgGlucose and avgGlucose > 126:
        recommendations.append("Monitor glucose levels regularly and consult healthcare provider")

    if avgSteps and avgSteps < 5000:
        recommendations.append("Increase daily activity target to 7000-10000 steps")

    if avgSleep and avgSleep < 6:
        recommendations.append("Aim for 7-9 hours of sleep per night")

    if avgHeartRate and avgHeartRate > 100:
        recommendations.append("Monitor heart rate and consider stress management")

    if not recommendations:
        recommendations.append("Continue maintaining current healthy lifestyle practices")

    # Calculate health score
    health_score = _calculateHealthScore(bmi, risks, avgGlucose)

    # Generate insights summary
    insights = []
    if height and weight:
        insights.append(f"Height: {height}m, Weight: {weight}kg")
    if bmi:
        insights.append(f"BMI: {bmi} ({_getBMICategory(bmi)})")
    if health_logs:
        insights.append(f"Health data: {len(health_logs)} days recorded")
    if avgSteps:
        insights.append(f"Average daily steps: {int(avgSteps)}")
    if avgGlucose:
        insights.append(f"Average glucose: {round(avgGlucose, 1)} mg/dL")

    return {
        "insights": insights,
        "risks": risks,
        "recommendations": recommendations,
        "health_score": health_score,
        "metrics": {
            "height": height,
            "weight": weight,
            "bmi": bmi,
            "avgSleep": round(avgSleep, 1) if avgSleep else 0,
            "avgSteps": int(avgSteps) if avgSteps else 0,
            "avgGlucose": round(avgGlucose, 1) if avgGlucose else 0,
            "avgHeartRate": int(avgHeartRate) if avgHeartRate else 0,
            "dataPoints": len(health_logs),
        },
        "llm_used": False,
        "model_used": None,
    }


def _calculateAverage(data: list, field: str) -> Optional[float]:
    """Calculate average value for a field from health logs."""
    if not data:
        return None

    values = [item.get(field) for item in data if field in item and item.get(field)]
    if not values:
        return None

    return sum(values) / len(values)


def _calculateBmiFromMetrics(height: Optional[float], weight: Optional[float]) -> Optional[float]:
    """Calculate BMI from height (meters) and weight (kg)."""
    if not height or not weight or height <= 0 or weight <= 0:
        return None

    try:
        bmi = weight / (height ** 2)
        return round(bmi, 1)
    except Exception:
        return None


def _calculateHealthScore(
    bmi: Optional[float], risks: list, avgGlucose: Optional[float]
) -> int:
    """Calculate overall health score (0-100)."""
    score = 100

    # BMI impact
    if bmi:
        if bmi >= 30 or bmi < 18.5:
            score -= 25
        elif bmi >= 25:
            score -= 15

    # Risk impact
    score -= len(risks) * 10

    # Glucose impact
    if avgGlucose and avgGlucose > 126:
        score -= 15

    return max(0, min(100, score))


def _getBMICategory(bmi: float) -> str:
    """Get BMI category label."""
    if bmi < 18.5:
        return "Underweight"
    elif bmi < 25:
        return "Healthy weight"
    elif bmi < 30:
        return "Overweight"
    else:
        return "Obese"

