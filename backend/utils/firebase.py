"""Firebase Admin SDK initialization."""
import os, base64, json, logging
import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

FIREBASE_KEY_PATHS = [
    "lifelytics-e92fd-firebase-adminsdk-fbsvc-cf79d1af99.json",
    "/app/lifelytics-e92fd-firebase-adminsdk-fbsvc-cf79d1af99.json",
]

_db = None


def initializeFirebase() -> bool:
    global _db

    if firebase_admin._apps:
        logger.info("Firebase already initialized")
        if _db is None:
            _db = firestore.client()
        return True

    try:
        # Production: use base64 env var (Render)
        encoded = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64")
        if encoded:
            service_account = json.loads(base64.b64decode(encoded))
            cred = credentials.Certificate(service_account)
            firebase_admin.initialize_app(cred)
            _db = firestore.client()
            logger.info("Firebase initialized from FIREBASE_SERVICE_ACCOUNT_BASE64")
            return True

        # Local: look for JSON file
        for path in FIREBASE_KEY_PATHS:
            if os.path.exists(path):
                cred = credentials.Certificate(path)
                firebase_admin.initialize_app(cred)
                _db = firestore.client()
                logger.info(f"Firebase initialized from file: {path}")
                return True

        logger.warning("No Firebase credentials found. Running in dev mode.")
        return False

    except Exception as e:
        logger.error(f"Firebase initialization failed: {str(e)}")
        return False


def getFirestoreClient():
    global _db
    if _db is None:
        if firebase_admin._apps:
            _db = firestore.client()
        else:
            logger.warning("Firebase not initialized. Call initializeFirebase() first.")
    return _db