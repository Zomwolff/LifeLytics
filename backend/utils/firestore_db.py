"""Firestore database operations for LifeLytics.

Provides async wrappers around Firestore operations for users, health logs, insights, and reports.
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from backend.utils.firebase import getFirestoreClient

logger = logging.getLogger(__name__)


async def createUser(userId: str, userData: Dict[str, Any]) -> bool:
    """Create a new user in Firestore.

    Args:
        userId: The user ID
        userData: Dictionary containing user profile data

    Returns:
        True if successful, False otherwise
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        db.collection("users").document(userId).set(userData)
        logger.info(f"Created user {userId} in Firestore")
        return True

    except Exception as e:
        logger.error(f"Error creating user {userId}: {str(e)}")
        return False


async def getUserProfile(userId: str) -> Optional[Dict[str, Any]]:
    """Get user profile from Firestore.

    Args:
        userId: The user ID

    Returns:
        User profile dictionary or None if not found
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return None

        doc = db.collection("users").document(userId).get()
        if doc.exists:
            return doc.to_dict()
        return None

    except Exception as e:
        logger.error(f"Error getting user profile {userId}: {str(e)}")
        return None


async def getAllUsers() -> List[Dict[str, Any]]:
    """Get all users from Firestore.

    Returns:
        List of user dictionaries
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return []

        docs = db.collection("users").stream()
        users = []
        for doc in docs:
            user_data = doc.to_dict()
            user_data["userId"] = doc.id
            users.append(user_data)

        return users

    except Exception as e:
        logger.error(f"Error getting all users: {str(e)}")
        return []


async def addHealthLog(userId: str, logData: Dict[str, Any]) -> bool:
    """Add a health log entry to user's health_logs subcollection.

    Args:
        userId: The user ID
        logData: Dictionary containing health log data

    Returns:
        True if successful, False otherwise
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        log_data_with_timestamp = {
            **logData,
            "timestamp": datetime.now().isoformat()
        }

        db.collection("users").document(userId).collection("health_logs").add(
            log_data_with_timestamp
        )
        logger.info(f"Added health log for user {userId}")
        return True

    except Exception as e:
        logger.error(f"Error adding health log for {userId}: {str(e)}")
        return False


async def getHealthLogs(userId: str) -> List[Dict[str, Any]]:
    """Get all health logs for a user.

    Args:
        userId: The user ID

    Returns:
        List of health log dictionaries
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return []

        docs = (
            db.collection("users")
            .document(userId)
            .collection("health_logs")
            .order_by("day")
            .stream()
        )
        logs = []
        for doc in docs:
            log_data = doc.to_dict()
            log_data["id"] = doc.id
            logs.append(log_data)

        return logs

    except Exception as e:
        logger.error(f"Error getting health logs for {userId}: {str(e)}")
        return []


async def saveInsight(userId: str, insightData: Dict[str, Any]) -> bool:
    """Save insight results to user's insights subcollection.

    Args:
        userId: The user ID
        insightData: Dictionary containing insight analysis

    Returns:
        True if successful, False otherwise
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        insight_data_with_timestamp = {
            **insightData,
            "timestamp": datetime.now().isoformat()
        }

        db.collection("users").document(userId).collection("insights").add(
            insight_data_with_timestamp
        )
        logger.info(f"Saved insight for user {userId}")
        return True

    except Exception as e:
        logger.error(f"Error saving insight for {userId}: {str(e)}")
        return False


async def getInsights(userId: str) -> List[Dict[str, Any]]:
    """Get all insights for a user.

    Args:
        userId: The user ID

    Returns:
        List of insight dictionaries
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return []

        docs = (
            db.collection("users")
            .document(userId)
            .collection("insights")
            .order_by("timestamp", direction="DESCENDING")
            .stream()
        )
        insights = []
        for doc in docs:
            insight_data = doc.to_dict()
            insight_data["id"] = doc.id
            insights.append(insight_data)

        return insights

    except Exception as e:
        logger.error(f"Error getting insights for {userId}: {str(e)}")
        return []


async def batchAddHealthLogs(
    userId: str, logsData: List[Dict[str, Any]]
) -> bool:
    """Add multiple health log entries in a batch.

    Args:
        userId: The user ID
        logsData: List of health log dictionaries

    Returns:
        True if successful, False otherwise
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        batch = db.batch()
        logs_ref = db.collection("users").document(userId).collection("health_logs")

        for log_data in logsData:
            log_with_timestamp = {
                **log_data,
                "timestamp": datetime.now().isoformat()
            }
            batch.set(logs_ref.document(), log_with_timestamp)

        batch.commit()
        logger.info(f"Batch added {len(logsData)} health logs for user {userId}")
        return True

    except Exception as e:
        logger.error(f"Error batch adding health logs for {userId}: {str(e)}")
        return False


async def deleteUserData(userId: str) -> bool:
    """Delete all user data from Firestore (for testing/cleanup).

    Args:
        userId: The user ID

    Returns:
        True if successful, False otherwise
    """
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        # Delete health logs
        logs = (
            db.collection("users")
            .document(userId)
            .collection("health_logs")
            .stream()
        )
        for log in logs:
            log.reference.delete()

        # Delete insights
        insights = (
            db.collection("users")
            .document(userId)
            .collection("insights")
            .stream()
        )
        for insight in insights:
            insight.reference.delete()

        # Delete reports
        reports = (
            db.collection("users")
            .document(userId)
            .collection("reports")
            .stream()
        )
        for report in reports:
            report.reference.delete()

        # Delete user document
        db.collection("users").document(userId).delete()
        logger.info(f"Deleted all data for user {userId}")
        return True

    except Exception as e:
        logger.error(f"Error deleting user data for {userId}: {str(e)}")
        return False
