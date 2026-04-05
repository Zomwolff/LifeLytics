"""Test routes for data simulation and reporting.

These endpoints allow generating realistic test data, simulating health metrics,
and viewing test user information. All data is stored in Firestore.
"""
import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from backend.services import simulationService, insightService
from backend.utils import firestore_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate-data")
async def generateData() -> Dict[str, Any]:
    """Generate test users, persist 7 days of data, and create insights.

    Flow:
    1. Create 7 test users with diverse profiles in Firestore
    2. Immediately persist 7 days of realistic health data in health_logs
    3. Generate insights and store them in Firestore

    Returns:
        Summary of generated data (users created, files generated)
    """
    try:
        # Generate 5-10 test users in Firestore
        n_users = 7
        user_ids = await simulationService.generateTestUsers(n_users)

        insights_generated = 0

        # Users already receive 7 days of logs during creation.
        for user_id in user_ids:
            # Generate insights for each user
            try:
                await insightService.generateInsights(user_id)
                insights_generated += 1
            except Exception as e:
                logger.error(f"Error generating insights for {user_id}: {str(e)}")

        report = await simulationService.generateSimulationReport(user_ids)
        report["insights_generated"] = insights_generated
        return report

    except Exception as e:
        logger.error(f"Error in generateData: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.get("/users")
async def getAllUsers() -> Dict[str, Any]:
    """Get all test users with their basic information from Firestore.

    Returns:
        Dictionary containing list of users with profile, height, weight, and stats
    """
    try:
        users_list = await firestore_db.getAllUsers()

        result_users = {}
        for user in users_list:
            user_id = user.get("userId")
            if user_id:
                # Get health logs count
                health_logs = await firestore_db.getHealthLogs(user_id)
                result_users[user_id] = {
                    "profileType": user.get("profileType"),
                    "height": user.get("height"),
                    "weight": user.get("weight"),
                    "healthLogsCount": len(health_logs),
                    "createdAt": user.get("createdAt"),
                }

        return {"users": result_users, "totalUsers": len(result_users)}

    except Exception as e:
        logger.error(f"Error getting all users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}")
async def getUserDataRoute(user_id: str) -> Dict[str, Any]:
    """Get full data for a specific test user from Firestore.

    Includes:
    - User profile (height, weight, profile type)
    - 30 days of health logs
    - Summary statistics

    Args:
        user_id: The user ID to retrieve

    Returns:
        Complete user data including profile, metrics, and health logs
    """
    try:
        # Get user profile from Firestore
        user_profile = await firestore_db.getUserProfile(user_id)
        if not user_profile:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")

        # Get health logs from Firestore
        health_logs = await firestore_db.getHealthLogs(user_id)

        # Calculate summary metrics
        if health_logs:
            avg_sleep = sum(log.get("sleep", 0) for log in health_logs) / len(health_logs)
            avg_steps = sum(log.get("steps", 0) for log in health_logs) / len(health_logs)
            avg_glucose = sum(log.get("glucose", 0) for log in health_logs) / len(health_logs)
            avg_heart_rate = sum(log.get("heartRate", 0) for log in health_logs) / len(health_logs)
        else:
            avg_sleep = avg_steps = avg_glucose = avg_heart_rate = 0

        return {
            "userId": user_id,
            "profileType": user_profile.get("profileType"),
            "height": user_profile.get("height"),
            "weight": user_profile.get("weight"),
            "createdAt": user_profile.get("createdAt"),
            "summary": {
                "avgSleep": round(avg_sleep, 1),
                "avgSteps": int(avg_steps),
                "avgGlucose": round(avg_glucose, 1),
                "avgHeartRate": int(avg_heart_rate),
                "totalDays": len(health_logs),
            },
            "healthLogs": health_logs,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user data for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/insights")
async def getUserInsights(user_id: str) -> Dict[str, Any]:
    """Get all insights for a specific test user from Firestore.

    Args:
        user_id: The user ID to retrieve insights for

    Returns:
        List of insight records with analysis, risks, and recommendations
    """
    try:
        insights_list = await firestore_db.getInsights(user_id)
        if not insights_list:
            # Generate fresh insights if none exist
            insights = await insightService.generateInsights(user_id)
            await firestore_db.saveInsight(user_id, insights)
            return {"insights": [insights], "count": 1}

        return {"insights": insights_list, "count": len(insights_list)}

    except Exception as e:
        logger.error(f"Error getting insights for {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

