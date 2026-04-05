"""In-memory database for development/testing.

Structure:
{
  "user_id": {
    "height": float,
    "weight": float,
    "health_logs": [],
    "reports": [],
    "glucose": [],
    "smartwatch": [],
    "insights_cache": {...},
    "last_insights_time": timestamp
  }
}

Note: In production, replace with Firestore or PostgreSQL.
Future: Migrate to Firestore with minimal changes.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json

_DB: Dict[str, Dict[str, Any]] = {}

# Cache settings
INSIGHTS_CACHE_TTL_MINUTES = 30


def getUserData(userId: str) -> Dict[str, Any]:
    """Get or create user data record."""
    if userId not in _DB:
        _DB[userId] = {
            "height": None,
            "weight": None,
            "healthLogs": [],
            "reports": [],
            "glucose": [],
            "smartwatch": [],
            "insightsCache": None,
            "lastInsightsTime": None,
        }
    return _DB[userId]


def setUserHeight(userId: str, height: float) -> None:
    """Set user height."""
    data = getUserData(userId)
    data["height"] = height


def setUserWeight(userId: str, weight: float) -> None:
    """Set user weight."""
    data = getUserData(userId)
    data["weight"] = weight


def addHealthLog(userId: str, logData: Dict[str, Any]) -> None:
    """Add health log entry."""
    data = getUserData(userId)
    data["healthLogs"].append({**logData, "timestamp": datetime.now().isoformat()})


def addSmartWatchData(userId: str, watchData: Dict[str, Any]) -> None:
    """Add smartwatch data."""
    data = getUserData(userId)
    data["smartwatch"].append({**watchData, "timestamp": datetime.now().isoformat()})


def addGlucoseReading(userId: str, glucoseData: Dict[str, Any]) -> None:
    """Add glucose reading."""
    data = getUserData(userId)
    data["glucose"].append({**glucoseData, "timestamp": datetime.now().isoformat()})


def addReport(userId: str, reportData: Dict[str, Any]) -> None:
    """Add health report."""
    data = getUserData(userId)
    data["reports"].append({**reportData, "timestamp": datetime.now().isoformat()})


def cacheInsights(userId: str, insights: Dict[str, Any]) -> None:
    """Cache generated insights."""
    data = getUserData(userId)
    data["insightsCache"] = insights
    data["lastInsightsTime"] = datetime.now()


def getInsightsFromCache(userId: str) -> Optional[Dict[str, Any]]:
    """Get cached insights if still valid."""
    data = getUserData(userId)
    if not data["insightsCache"] or not data["lastInsightsTime"]:
        return None

    elapsed = datetime.now() - data["lastInsightsTime"]
    if elapsed < timedelta(minutes=INSIGHTS_CACHE_TTL_MINUTES):
        return data["insightsCache"]

    return None


def getAllUserData(userId: str) -> Dict[str, Any]:
    """Get complete user data for frontend."""
    return getUserData(userId)


def getHealthLogs(userId: str) -> List[Dict[str, Any]]:
    """Get all health logs."""
    data = getUserData(userId)
    return data.get("healthLogs", [])


def getReports(userId: str) -> List[Dict[str, Any]]:
    """Get all reports."""
    data = getUserData(userId)
    return data.get("reports", [])


def getSmartWatchData(userId: str) -> List[Dict[str, Any]]:
    """Get all smartwatch data."""
    data = getUserData(userId)
    return data.get("smartwatch", [])


def getGlucoseReadings(userId: str) -> List[Dict[str, Any]]:
    """Get all glucose readings."""
    data = getUserData(userId)
    return data.get("glucose", [])


def getInsightsHistory(userId: str) -> List[Dict[str, Any]]:
    """Get insights history (simplified)."""
    data = getUserData(userId)
    if data.get("insightsCache"):
        return [data["insightsCache"]]
    return []


def resetDb() -> None:
    """Reset entire database (testing only)."""
    global _DB
    _DB = {}


def exportDb() -> Dict[str, Dict[str, Any]]:
    """Export entire database (debugging/backup)."""
    return json.loads(json.dumps(_DB, default=str))
