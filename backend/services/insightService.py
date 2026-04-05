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

from datetime import date, timedelta
from typing import Dict, Any, Optional

from backend.utils import firestore_db
from backend.utils.datetime_ist import now_ist
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
        await firestore_db.saveInsight(userId, ruleBasedInsights)
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
            await firestore_db.saveInsight(userId, enhancedInsights)

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
            await firestore_db.saveInsight(userId, ruleBasedInsights)
            return ruleBasedInsights


async def _generateRuleBasedInsights(userId: str) -> Dict[str, Any]:
    """Generate rule-based health insights from Firestore data."""
    user_profile = await firestore_db.getUserProfile(userId)
    if not user_profile:
        logger.error(f"User {userId} not found in Firestore")
        return {
            "insights": [],
            "risks": ["User data not found"],
            "recommendations": [],
            "healthScore": 0,
            "llm_summary": {
                "avg_sleep": 0,
                "avg_steps": 0,
                "avg_glucose": 0,
                "avg_calories_intake": 0,
                "avg_calories_burned": 0,
                "trend_summary": "No health data available",
                "data_points": 0,
            },
            "llm_used": False,
            "model_used": None,
            "explanation": "No health data available yet.",
        }

    weekly_context = await firestore_db.getLatestTrendContext(userId)
    if weekly_context:
        weekly_data = _weeklyDataFromContext(weekly_context)
    else:
        weekly_data = await _getWeeklyAnalytics(userId)
    weekly_averages = weekly_data["averages"]
    weekly_trends = weekly_data["trends"]

    height_cm = user_profile.get("heightCm")
    weight_kg = user_profile.get("weightKg") or user_profile.get("weight")
    bmi = _calculateBmiFromMetrics(
        (float(height_cm) / 100.0) if height_cm else user_profile.get("height"),
        weight_kg,
    )

    avgSleep = weekly_averages["sleep"]
    avgSteps = weekly_averages["steps"]
    avgGlucose = weekly_averages["glucose"]
    avgCaloriesIntake = weekly_averages["calories_intake"]
    avgCaloriesBurned = weekly_averages["calories_burned"]
    avgProtein = weekly_averages["protein"]
    avgCarbs = weekly_averages["carbs"]
    avgFats = weekly_averages["fats"]
    caloriesTarget = user_profile.get("caloriesTarget") or 2000

    risks = []
    recommendations = []
    insights = []

    if avgSleep < 7:
        risks.append("Sleep duration is below the recommended range")
        recommendations.append("Protect 7-8 hours of sleep and keep your bedtime more consistent")
    elif avgSleep > 9:
        risks.append("Sleep duration is unusually high")
        recommendations.append("Review your recovery, stress, and sleep schedule")

    if avgSteps < 7000:
        risks.append("Daily activity is below a healthy weekly average")
        recommendations.append("Add a 20-30 minute walk or one extra active block each day")

    if avgGlucose > 110:
        risks.append("Average glucose is trending higher than ideal")
        recommendations.append("Pair carbs with protein/fiber and keep post-meal movement consistent")

    if avgCaloriesIntake > caloriesTarget * 1.1:
        risks.append("Weekly calorie intake is above your target")
        recommendations.append("Trim one snack or portion size to bring intake closer to target")

    if avgProtein < 70 and avgProtein > 0:
        recommendations.append("Increase protein at meals to support recovery and fullness")

    if avgCarbs > 0 and avgFats > 0 and avgGlucose > 100:
        recommendations.append("Keep carb-heavy meals paired with protein and fiber for steadier glucose")

    if avgCaloriesBurned > 0 and avgSteps > 0 and avgCaloriesBurned < 300:
        recommendations.append("Your burn is modest this week; a few more active minutes would help")

    if bmi:
        if bmi >= 30:
            risks.append("BMI is in the obesity range")
            recommendations.append("Focus on gradual, sustainable weight loss with activity and portion control")
        elif bmi >= 25:
            risks.append("BMI is in the overweight range")
            recommendations.append("A small calorie deficit and regular movement can help bring BMI down")
        elif bmi < 18.5:
            risks.append("BMI is below the healthy range")
            recommendations.append("Prioritize adequate calories and protein to support healthy weight gain")

    if not recommendations:
        recommendations.append("Your week looks balanced. Keep the same routines and stay consistent")

    health_score = _calculateWeeklyHealthScore(
        bmi=bmi,
        avgSleep=avgSleep,
        avgSteps=avgSteps,
        avgGlucose=avgGlucose,
        avgCaloriesIntake=avgCaloriesIntake,
        caloriesTarget=caloriesTarget,
    )

    trend_summary = (
        f"sleep {weekly_trends['sleep']}, steps {weekly_trends['steps']}, glucose {weekly_trends['glucose']}"
    )
    explanation = (
        f"This week you averaged {avgSleep:.1f} hours of sleep, {avgSteps:,.0f} steps per day, "
        f"{avgGlucose:.1f} mg/dL glucose, and {avgCaloriesIntake:.0f} kcal intake. "
        f"Sleep was {weekly_trends['sleep']}, activity was {weekly_trends['steps']}, and glucose was {weekly_trends['glucose']}."
    )

    insights.append(f"This week your sleep averaged {avgSleep:.1f} hours and was {weekly_trends['sleep']}.")
    insights.append(f"You averaged {int(avgSteps):,} steps per day, which is {weekly_trends['steps']}.")
    insights.append(f"Your average glucose was {avgGlucose:.1f} mg/dL and was {weekly_trends['glucose']}.")
    insights.append(f"You averaged {avgCaloriesIntake:.0f} kcal intake against a target of {caloriesTarget:.0f} kcal.")

    return {
        "insights": insights,
        "risks": risks,
        "recommendations": recommendations,
        "healthScore": health_score,
        "llm_summary": {
            "avg_sleep": round(avgSleep, 1) if avgSleep else 0,
            "avg_steps": int(avgSteps) if avgSteps else 0,
            "avg_glucose": round(avgGlucose, 1) if avgGlucose else 0,
            "avg_calories_intake": round(avgCaloriesIntake, 1) if avgCaloriesIntake else 0,
            "avg_calories_burned": round(avgCaloriesBurned, 1) if avgCaloriesBurned else 0,
            "avg_protein": round(avgProtein, 1) if avgProtein else 0,
            "trend_summary": trend_summary,
            "data_points": len(weekly_data["dates"]),
        },
        "metrics": {
            "height": (float(height_cm) / 100.0) if height_cm else user_profile.get("height"),
            "weight": weight_kg,
            "bmi": bmi,
            "avgSleep": round(avgSleep, 1) if avgSleep else 0,
            "avgSteps": int(avgSteps) if avgSteps else 0,
            "avgGlucose": round(avgGlucose, 1) if avgGlucose else 0,
            "avgCaloriesIntake": round(avgCaloriesIntake, 1) if avgCaloriesIntake else 0,
            "avgCaloriesBurned": round(avgCaloriesBurned, 1) if avgCaloriesBurned else 0,
            "avgProtein": round(avgProtein, 1) if avgProtein else 0,
            "avgCarbs": round(avgCarbs, 1) if avgCarbs else 0,
            "avgFats": round(avgFats, 1) if avgFats else 0,
            "dataPoints": len(weekly_data["dates"]),
        },
        "explanation": explanation,
        "llm_used": False,
        "model_used": None,
    }


def _weeklyDataFromContext(context: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize the payload saved by the Trends page into weekly analytics."""
    dates = list(context.get("dates") or [])
    sleep = list(context.get("sleep") or context.get("weeklySleep") or [])
    steps = list(context.get("steps") or context.get("weeklySteps") or [])
    glucose = list(context.get("glucose") or context.get("weeklyBloodGlucose") or [])
    heart_rate = list(context.get("heart_rate") or context.get("weeklyHeartRate") or [])
    calories_intake = list(context.get("calories_intake") or context.get("weeklyCaloriesIntake") or [])
    calories_burned = list(context.get("calories_burned") or context.get("weeklyCaloriesBurned") or [])
    protein = list(context.get("weeklyProtein") or [])
    carbs = list(context.get("weeklyCarbs") or [])
    fats = list(context.get("weeklyFats") or [])

    return {
        "dates": dates,
        "sleep": sleep,
        "steps": steps,
        "glucose": glucose,
        "heart_rate": heart_rate,
        "calories_intake": calories_intake,
        "calories_burned": calories_burned,
        "protein": protein,
        "carbs": carbs,
        "fats": fats,
        "averages": {
            "sleep": _average(sleep),
            "steps": _average(steps),
            "glucose": _average(glucose),
            "heart_rate": _average(heart_rate),
            "calories_intake": _average(calories_intake),
            "calories_burned": _average(calories_burned),
            "protein": _average(protein),
            "carbs": _average(carbs),
            "fats": _average(fats),
        },
        "trends": {
            "sleep": _trendLabel(sleep),
            "steps": _trendLabel([float(v) for v in steps]) if steps else "stable",
            "glucose": _trendLabel(glucose),
        },
    }


async def _getWeeklyAnalytics(userId: str) -> Dict[str, Any]:
    """Build the same weekly series that powers the Trends page."""
    db = firestore_db.getFirestoreClient()
    if not db:
        return {
            "dates": [],
            "sleep": [0.0] * 7,
            "steps": [0] * 7,
            "glucose": [0.0] * 7,
            "heart_rate": [0] * 7,
            "calories_intake": [0.0] * 7,
            "calories_burned": [0.0] * 7,
            "protein": [0.0] * 7,
            "carbs": [0.0] * 7,
            "fats": [0.0] * 7,
            "averages": {
                "sleep": 0.0,
                "steps": 0.0,
                "glucose": 0.0,
                "heart_rate": 0.0,
                "calories_intake": 0.0,
                "calories_burned": 0.0,
                "protein": 0.0,
                "carbs": 0.0,
                "fats": 0.0,
            },
            "trends": {"sleep": "stable", "steps": "stable", "glucose": "stable"},
        }

    today = now_ist().date()
    week_start = today - timedelta(days=6)
    ordered_days = [week_start + timedelta(days=offset) for offset in range(7)]
    by_day = {
        day.isoformat(): {
            "sleep": 0.0,
            "steps": 0.0,
            "glucose": 0.0,
            "heart_rate": 0.0,
            "calories_intake": 0.0,
            "calories_burned": 0.0,
            "protein": 0.0,
            "carbs": 0.0,
            "fats": 0.0,
        }
        for day in ordered_days
    }

    meals_docs = db.collection("users").document(userId).collection("meals").stream()
    for doc in meals_docs:
        row = doc.to_dict()
        row_date = _extract_date_iso(row)
        if row_date not in by_day or date.fromisoformat(row_date) > today:
            continue
        by_day[row_date]["calories_intake"] += _calculateNumberField(row, ["calories"])
        by_day[row_date]["protein"] += _calculateNumberField(row, ["protein"])
        by_day[row_date]["carbs"] += _calculateNumberField(row, ["carbohydrates"])
        by_day[row_date]["fats"] += _calculateNumberField(row, ["totalFat"])

    smartwatch_docs = db.collection("users").document(userId).collection("smartwatch").stream()
    for doc in smartwatch_docs:
        row = doc.to_dict()
        row_date = _extract_date_iso(row)
        if row_date not in by_day or date.fromisoformat(row_date) > today:
            continue
        by_day[row_date]["steps"] = max(by_day[row_date]["steps"], _calculateNumberField(row, ["steps"]))
        by_day[row_date]["sleep"] = max(by_day[row_date]["sleep"], _calculateNumberField(row, ["sleepDuration"]))
        by_day[row_date]["calories_burned"] = max(
            by_day[row_date]["calories_burned"], _calculateNumberField(row, ["caloriesBurned"])
        )
        by_day[row_date]["heart_rate"] = max(by_day[row_date]["heart_rate"], _calculateNumberField(row, ["heartRate"]))

    health_docs = db.collection("users").document(userId).collection("health_logs").stream()
    for doc in health_docs:
        row = doc.to_dict()
        row_date = _extract_date_iso(row)
        if row_date not in by_day or date.fromisoformat(row_date) > today:
            continue
        by_day[row_date]["sleep"] = max(by_day[row_date]["sleep"], _calculateNumberField(row, ["sleep"]))
        by_day[row_date]["steps"] = max(by_day[row_date]["steps"], _calculateNumberField(row, ["steps"]))
        by_day[row_date]["glucose"] = max(by_day[row_date]["glucose"], _calculateNumberField(row, ["glucose", "glucoseLevel", "value"]))
        by_day[row_date]["heart_rate"] = max(by_day[row_date]["heart_rate"], _calculateNumberField(row, ["heartRate"]))

    dates = [day.isoformat() for day in ordered_days]
    sleep = [round(by_day[day]["sleep"], 1) for day in dates]
    steps = [int(by_day[day]["steps"]) for day in dates]
    glucose = [round(by_day[day]["glucose"], 1) for day in dates]
    heart_rate = [int(by_day[day]["heart_rate"]) for day in dates]
    calories_intake = [round(by_day[day]["calories_intake"], 1) for day in dates]
    calories_burned = [round(by_day[day]["calories_burned"], 1) for day in dates]
    protein = [round(by_day[day]["protein"], 1) for day in dates]
    carbs = [round(by_day[day]["carbs"], 1) for day in dates]
    fats = [round(by_day[day]["fats"], 1) for day in dates]

    return {
        "dates": dates,
        "sleep": sleep,
        "steps": steps,
        "glucose": glucose,
        "heart_rate": heart_rate,
        "calories_intake": calories_intake,
        "calories_burned": calories_burned,
        "protein": protein,
        "carbs": carbs,
        "fats": fats,
        "averages": {
            "sleep": _average(sleep),
            "steps": _average(steps),
            "glucose": _average(glucose),
            "heart_rate": _average(heart_rate),
            "calories_intake": _average(calories_intake),
            "calories_burned": _average(calories_burned),
            "protein": _average(protein),
            "carbs": _average(carbs),
            "fats": _average(fats),
        },
        "trends": {
            "sleep": _trendLabel(sleep),
            "steps": _trendLabel([float(v) for v in steps]),
            "glucose": _trendLabel(glucose),
        },
    }


def _trendLabel(values: list[float]) -> str:
    if len(values) < 2:
        return "stable"

    first = float(values[0])
    last = float(values[-1])
    delta = last - first
    threshold = max(abs(first), 1.0) * 0.05

    if delta > threshold:
        return "increasing"
    if delta < -threshold:
        return "decreasing"
    return "stable"


def _calculateNumberField(row: dict, fields: list[str]) -> float:
    for field in fields:
        value = row.get(field)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                continue
    return 0.0


def _buildTrendSummary(weekly_data: dict) -> str:
    """Build concise trend summary for LLM input."""
    if not weekly_data.get("dates"):
        return "Insufficient trend data"

    averages = weekly_data.get("averages", {})
    trends = weekly_data.get("trends", {})

    return (
        f"sleep {trends.get('sleep', 'stable')} at {averages.get('sleep', 0):.1f}h, "
        f"steps {trends.get('steps', 'stable')} at {averages.get('steps', 0):.0f}/day, "
        f"glucose {trends.get('glucose', 'stable')} at {averages.get('glucose', 0):.1f} mg/dL"
    )

    ordered = sorted(health_logs, key=lambda row: row.get("timestamp", ""))
    first = ordered[0]
    last = ordered[-1]

    def _trend_for(field: str) -> str:
        start = float(first.get(field, 0) or 0)
        end = float(last.get(field, 0) or 0)
        delta = end - start
        threshold = max(abs(start), 1) * 0.05
        if delta > threshold:
            return "increasing"
        if delta < -threshold:
            return "decreasing"
        return "stable"

    return (
        f"sleep {_trend_for('sleep')}, "
        f"steps {_trend_for('steps')}, "
        f"glucose {_trend_for('glucose')}"
    )


def _calculateAverage(data: list, field: str) -> Optional[float]:
    """Calculate average value for a field from health logs."""
    if not data:
        return None

    values = [item.get(field) for item in data if field in item and item.get(field)]
    if not values:
        return None

    return sum(values) / len(values)


def _average(values: list) -> float:
    if not values:
        return 0.0
    return sum(float(value or 0) for value in values) / len(values)


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


def _calculateWeeklyHealthScore(
    bmi: Optional[float],
    avgSleep: float,
    avgSteps: float,
    avgGlucose: float,
    avgCaloriesIntake: float,
    caloriesTarget: float,
) -> int:
    """Calculate a user-friendly score from the same weekly trend data."""
    score = 100

    if bmi:
        if bmi >= 30 or bmi < 18.5:
            score -= 15
        elif bmi >= 25:
            score -= 10

    if avgSleep < 7:
        score -= 10
    elif avgSleep > 9:
        score -= 5

    if avgSteps < 7000:
        score -= 10
    elif avgSteps < 5000:
        score -= 10

    if avgGlucose > 126:
        score -= 20
    elif avgGlucose > 110:
        score -= 10

    if avgCaloriesIntake > caloriesTarget * 1.1:
        score -= 5

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

