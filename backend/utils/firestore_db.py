"""Firestore database operations for LifeLytics.

Provides async wrappers around Firestore operations for users, health logs,
insights, reports, and related collections.
"""

import uuid
from firebase_admin import firestore
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from backend.utils.firebase import getFirestoreClient

logger = logging.getLogger(__name__)


def _users_ref(db):
    return db.collection("users")


def _user_ref(db, userId: str):
    return _users_ref(db).document(userId)


def _log_write(userId: str) -> None:
    logger.info(f"Writing to Firestore: {userId}")


def _log_read(userId: str) -> None:
    logger.info(f"Reading from Firestore: {userId}")


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

        _log_write(userId)
        _user_ref(db, userId).set(userData)
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

        _log_read(userId)
        doc = _user_ref(db, userId).get()
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

        docs = _users_ref(db).stream()
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

        _log_write(userId)
        _user_ref(db, userId).collection("health_logs").add(log_data_with_timestamp)
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

        _log_read(userId)
        docs = _user_ref(db, userId).collection("health_logs").stream()
        logs = []
        for doc in docs:
            log_data = doc.to_dict()
            log_data["id"] = doc.id
            logs.append(log_data)

        logs.sort(key=lambda item: item.get("timestamp", ""), reverse=True)

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

        _log_write(userId)
        _user_ref(db, userId).collection("insights").add(insight_data_with_timestamp)
        logger.info(f"Saved insight for user {userId}")
        return True

    except Exception as e:
        logger.error(f"Error saving insight for {userId}: {str(e)}")
        return False


async def saveTrendContext(userId: str, contextData: Dict[str, Any]) -> bool:
    """Store the latest trends-page weekly payload for later insight generation."""
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        payload = {
            **contextData,
            "type": "trend_context",
            "source": "trends_page",
            "timestamp": datetime.now().isoformat(),
        }

        _log_write(userId)
        _user_ref(db, userId).collection("insights").add(payload)
        return True
    except Exception as e:
        logger.error(f"Error saving trend context for {userId}: {str(e)}")
        return False


async def getLatestTrendContext(userId: str) -> Optional[Dict[str, Any]]:
    """Get the newest trends-page payload stored in insights."""
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return None

        _log_read(userId)
        docs = _user_ref(db, userId).collection("insights").stream()
        trend_docs: List[Dict[str, Any]] = []
        for doc in docs:
            row = doc.to_dict()
            if row.get("type") == "trend_context":
                row["id"] = doc.id
                trend_docs.append(row)

        if not trend_docs:
            return None

        trend_docs.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
        return trend_docs[0]
    except Exception as e:
        logger.error(f"Error getting trend context for {userId}: {str(e)}")
        return None


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

        _log_read(userId)
        docs = _user_ref(db, userId).collection("insights").stream()
        insights = []
        for doc in docs:
            insight_data = doc.to_dict()
            insight_data["id"] = doc.id
            insights.append(insight_data)

        insights.sort(key=lambda item: item.get("timestamp", ""), reverse=True)

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
        _log_write(userId)
        logs_ref = _user_ref(db, userId).collection("health_logs")

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
        logs = _user_ref(db, userId).collection("health_logs").stream()
        for log in logs:
            log.reference.delete()

        # Delete insights
        insights = _user_ref(db, userId).collection("insights").stream()
        for insight in insights:
            insight.reference.delete()

        # Delete reports
        reports = _user_ref(db, userId).collection("reports").stream()
        for report in reports:
            report.reference.delete()

        # Delete user document
        _user_ref(db, userId).delete()
        logger.info(f"Deleted all data for user {userId}")
        return True

    except Exception as e:
        logger.error(f"Error deleting user data for {userId}: {str(e)}")
        return False


async def updateUserProfile(userId: str, updates: Dict[str, Any]) -> bool:
    """Update fields on the user document."""
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        _log_write(userId)
        _user_ref(db, userId).set(updates, merge=True)
        return True
    except Exception as e:
        logger.error(f"Error updating user profile {userId}: {str(e)}")
        return False


async def getCollectionDocs(userId: str, collectionName: str) -> List[Dict[str, Any]]:
    """Fetch all docs from users/{user_id}/{collectionName}."""
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return []

        _log_read(userId)
        docs = _user_ref(db, userId).collection(collectionName).stream()
        rows: List[Dict[str, Any]] = []
        for doc in docs:
            row = doc.to_dict()
            row["id"] = doc.id
            rows.append(row)
        return rows
    except Exception as e:
        logger.error(
            f"Error fetching collection {collectionName} for {userId}: {str(e)}"
        )
        return []


async def addCollectionDoc(
    userId: str, collectionName: str, payload: Dict[str, Any]
) -> bool:
    """Add document to users/{user_id}/{collectionName}."""
    try:
        db = getFirestoreClient()
        if not db:
            logger.error("Firestore client not available")
            return False

        _log_write(userId)
        _user_ref(db, userId).collection(collectionName).add(payload)
        return True
    except Exception as e:
        logger.error(
            f"Error adding document to collection {collectionName} for {userId}: {str(e)}"
        )
        return False

async def saveReport(userId: str, parsed: Dict[str, Any]) -> str:
    """Save parsed report to Firestore under reports/{reportId}."""
    try:
        db = getFirestoreClient()
        reportId = parsed.get("scanId") or str(uuid.uuid4())
        db.collection("reports").document(reportId).set({
            "reportId": reportId,
            "userId": userId,
            "filename": parsed.get("filename"),
            "uploadedAt": firestore.SERVER_TIMESTAMP,
            "status": parsed.get("status", "good"),
            "summary": parsed.get("summary", ""),
            "details": parsed.get("details", ""),
            "nextCheckIn": parsed.get("nextCheckIn"),
            "nutrients": parsed.get("nutrients", {}),
            "metabolicMarkers": parsed.get("metabolic_markers", {}),
            "followUpHistory": [],
        })
        logger.info(f"Saved report {reportId} for user {userId}")
        return reportId
    except Exception as e:
        logger.error(f"Failed to save report: {e}")
        return None


async def getReports(userId: str) -> list:
    """Get all reports for a user."""
    try:
        db = getFirestoreClient()
        docs = db.collection("reports").where("userId", "==", userId).stream()
        reports = []
        for doc in docs:
            data = doc.to_dict()
            data["reportId"] = doc.id
            reports.append(data)
        return reports
    except Exception as e:
        logger.error(f"Failed to get reports: {e}")
        return []
    
    async def saveChatMessage(userId: str, role: str, text: str) -> Optional[str]:
    """Save a single chat message to users/{userId}/chat_history."""
    try:
        db = getFirestoreClient()
        if not db:
            return None
        _log_write(userId)
        _, ref = _user_ref(db, userId).collection("chat_history").add({
            "role": role,
            "text": text,
            "timestamp": datetime.now().isoformat(),
        })
        return ref.id
    except Exception as e:
        logger.error(f"Error saving chat message for {userId}: {str(e)}")
        return None


async def getChatHistory(userId: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent chat history for a user, oldest first."""
    try:
        db = getFirestoreClient()
        if not db:
            return []
        _log_read(userId)
        docs = _user_ref(db, userId).collection("chat_history").stream()
        messages = []
        for doc in docs:
            row = doc.to_dict()
            row["id"] = doc.id
            messages.append(row)
        messages.sort(key=lambda x: x.get("timestamp", ""))
        return messages[-limit:]  # return last N messages
    except Exception as e:
        logger.error(f"Error getting chat history for {userId}: {str(e)}")
        return []


async def clearChatHistory(userId: str) -> bool:
    """Clear all chat history for a user."""
    try:
        db = getFirestoreClient()
        if not db:
            return False
        docs = _user_ref(db, userId).collection("chat_history").stream()
        for doc in docs:
            doc.reference.delete()
        logger.info(f"Cleared chat history for {userId}")
        return True
    except Exception as e:
        logger.error(f"Error clearing chat history for {userId}: {str(e)}")
        return False