"""Data simulation service for generating realistic test users and health data.

This service creates realistic health profiles and simulates 30 days of data,
including sleep, steps, glucose, and heart rate patterns based on user profile.
Stores all data in Firestore for persistent storage.
"""
import random
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Any
from backend.utils import firestore_db

logger = logging.getLogger(__name__)


class HealthProfile:
    """Represents a health profile with baseline characteristics."""

    def __init__(self, profile_type: str):
        self.profile_type = profile_type
        self.baseline_sleep = 7.0
        self.baseline_steps = 8000
        self.baseline_glucose = 100
        self.baseline_heart_rate = 75

        if profile_type == "athlete":
            self.baseline_steps = 12000
            self.baseline_glucose = 95
            self.baseline_heart_rate = 60
        elif profile_type == "sedentary":
            self.baseline_steps = 3000
            self.baseline_glucose = 120
            self.baseline_heart_rate = 85
        elif profile_type == "diabetic-risk":
            self.baseline_steps = 5000
            self.baseline_glucose = 140
            self.baseline_heart_rate = 80


async def generateTestUsers(n_users: int = 5) -> List[str]:
    """Generate test users with diverse health profiles and store in Firestore.

    Args:
        n_users: Number of test users to generate (default: 5)

    Returns:
        List of user IDs created
    """
    profiles = ["athlete", "sedentary", "diabetic-risk", "active"]
    user_ids = []

    for i in range(n_users):
        user_id = f"test_user_{i+1}"
        profile = profiles[i % len(profiles)]

        # Create user profile data
        user_data = {
            "userId": user_id,
            "height": round(random.uniform(1.5, 1.9), 2),
            "weight": round(random.uniform(50, 100), 1),
            "profileType": profile,
            "createdAt": datetime.now().isoformat(),
        }

        # Save to Firestore
        success = await firestore_db.createUser(user_id, user_data)
        if success:
            user_ids.append(user_id)
            logger.info(f"Created test user {user_id} with profile {profile}")
        else:
            logger.error(f"Failed to create test user {user_id}")

    return user_ids


async def simulateMonthData(user_id: str) -> None:
    """Simulate 30 days of realistic health data for a user and store in Firestore.

    Args:
        user_id: The user ID to simulate data for
    """
    # Get user profile to determine baseline values
    user_profile = await firestore_db.getUserProfile(user_id)
    if not user_profile:
        logger.error(f"User {user_id} not found")
        return

    profile_type = user_profile.get("profileType", "active")
    profile = HealthProfile(profile_type)

    health_logs = []

    for day in range(1, 31):
        # Add randomness and trends
        day_variation = (day - 15) / 30  # Trend over the month
        random_factor = random.uniform(-1, 1)

        # Simulate sleep (4-9 hours)
        sleep = max(4, min(9, profile.baseline_sleep + random_factor * 1.5))

        # Simulate steps (affected by sleep quality)
        steps = int(
            max(
                1000,
                profile.baseline_steps
                + random_factor * 3000
                + day_variation * 1000,
            )
        )

        # Simulate glucose (should trend with activity/food)
        glucose = max(
            70,
            min(
                250,
                profile.baseline_glucose
                + random_factor * 20
                - (steps / 10000) * 10,
            ),
        )

        # Simulate heart rate (affected by sleep and activity)
        heart_rate = int(
            max(
                50,
                min(
                    120,
                    profile.baseline_heart_rate
                    + random_factor * 15
                    + (steps / 5000) * 5,
                ),
            )
        )

        log_entry = {
            "day": day,
            "sleep": round(sleep, 1),
            "steps": steps,
            "glucose": round(glucose, 1),
            "heartRate": heart_rate,
            "timestamp": f"2026-03-{day:02d}T08:00:00",
        }

        health_logs.append(log_entry)

    # Batch add all health logs to Firestore
    success = await firestore_db.batchAddHealthLogs(user_id, health_logs)
    if success:
        logger.info(f"Simulated 30 days of data for user {user_id}")
    else:
        logger.error(f"Failed to simulate data for user {user_id}")



async def saveInsightsToFile(user_id: str, insights: Dict[str, Any]) -> str:
    """Save user insights to a text file.

    Args:
        user_id: The user ID
        insights: Insights dictionary containing health analysis

    Returns:
        Path to the saved file
    """
    filename = f"insights_{user_id}.txt"

    content = f"""LifeLytics Health Insights Report
================================

User ID: {user_id}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Health Score: {insights.get('health_score', 0)}/100

Insights:
"""

    for insight in insights.get("insights", []):
        content += f"  - {insight}\n"

    content += "\nRisks:\n"
    for risk in insights.get("risks", []):
        content += f"  - {risk}\n"

    content += "\nRecommendations:\n"
    for rec in insights.get("recommendations", []):
        content += f"  - {rec}\n"

    with open(filename, "w") as f:
        f.write(content)

    logger.info(f"Saved insights to file {filename}")
    return filename


async def generateSimulationReport(user_ids: List[str]) -> Dict[str, Any]:
    """Generate a summary report of the simulation.

    Args:
        user_ids: List of user IDs that were simulated

    Returns:
        Summary report dictionary
    """
    report = {
        "users_created": len(user_ids),
        "files_generated": len(user_ids),
        "timestamp": datetime.now().isoformat(),
        "user_list": user_ids,
    }

    return report

