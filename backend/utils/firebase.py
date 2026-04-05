"""Firebase Admin SDK initialization.

Handles one-time initialization of Firebase for authentication and Firestore.
Supports both production (with service account) and dev (without).
"""

import os
import logging
import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

# Try these paths for Firebase service account
FIREBASE_KEY_PATHS = [
    "lifelytics-e92fd-firebase-adminsdk-fbsvc-cf79d1af99.json",
    "firebase_key.json",
    os.path.join(os.path.expanduser("~"), "firebase_key.json"),
]

_db = None


def initializeFirebase() -> bool:
    """Initialize Firebase Admin SDK using service account credentials.

    Process:
    1. Check if already initialized
    2. Look for service account JSON file
    3. Initialize Firebase and Firestore or log warning for dev mode

    Returns:
        True if initialization successful, False otherwise

    Notes:
        - Only initializes once (checked via firebase_admin._apps)
        - Gracefully falls back to dev mode if credentials missing
        - Uses token as uid in dev mode (for testing)
    """
    global _db

    # Already initialized
    if firebase_admin._apps:
        logger.info("Firebase already initialized")
        if _db is None:
            _db = firestore.client()
        return True

    # Try to find service account file
    keyPath = None
    for possiblePath in FIREBASE_KEY_PATHS:
        if os.path.exists(possiblePath):
            keyPath = possiblePath
            logger.info(f"Found Firebase credentials at: {keyPath}")
            break

    # If no credentials found
    if not keyPath:
        logger.warning(
            "Firebase service account not found. Running in development mode. "
            "To enable authentication, add your service account JSON file."
        )
        return False

    # Initialize Firebase
    try:
        cred = credentials.Certificate(keyPath)
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
        logger.info("Firebase initialized successfully with Firestore client")
        return True

    except FileNotFoundError:
        logger.error(f"Firebase credentials file not found: {keyPath}")
        return False

    except ValueError as e:
        logger.error(f"Invalid Firebase credentials format: {str(e)}")
        return False

    except Exception as e:
        logger.error(f"Firebase initialization failed: {str(e)}")
        return False


def getFirestoreClient():
    """Get Firestore client instance.

    Returns:
        Firestore client or None if not initialized
    """
    global _db
    if _db is None:
        if firebase_admin._apps:
            _db = firestore.client()
        else:
            logger.warning("Firebase not initialized. Call initializeFirebase() first.")
    return _db

