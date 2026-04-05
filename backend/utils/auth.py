"""Firebase authentication utilities.

Handles JWT token verification and user extraction from Authorization header.
Supports both production (Firebase enabled) and development (fallback) modes.
Development mode allows API testing without Firebase token.
"""

from typing import Optional
from fastapi import Header, HTTPException, status
import firebase_admin
from firebase_admin import auth as firebaseAuth
import logging
import os

logger = logging.getLogger(__name__)

# Development mode: Allow requests without token
DEV_MODE = os.getenv("DEV_MODE", "true").lower() == "true"


def getCurrentUser(authorization: str) -> str:
    """Verify Authorization header and return Firebase uid.

    Development Mode (DEV_MODE=true):
    - Missing header: Return 'test_user_1'
    - Invalid token: Return 'test_user_1'
    - Log fallback usage

    Production Mode (DEV_MODE=false):
    - Require valid Firebase token
    - Raise HTTPException on failure

    Args:
        authorization: Authorization header value (e.g., "Bearer <token>")

    Returns:
        user_id (uid) from token or fallback

    Raises:
        HTTPException: If token invalid in production mode
    """
    if not authorization:
        if DEV_MODE:
            logger.info("DEV MODE: No Authorization header. Using fallback user: test_user_1")
            return "test_user_1"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        if DEV_MODE:
            logger.info("DEV MODE: Invalid Authorization header format. Using fallback user: test_user_1")
            return "test_user_1"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Use: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]

    # Check if Firebase is initialized
    if not firebase_admin._apps:
        if DEV_MODE:
            logger.warning("DEV MODE: Firebase not initialized. Using fallback user: test_user_1")
            return "test_user_1"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase not initialized",
        )

    try:
        decoded = firebaseAuth.verify_id_token(token)
        uid = decoded.get("uid")
        if not uid:
            if DEV_MODE:
                logger.warning("DEV MODE: Token has no uid. Using fallback user: test_user_1")
                return "test_user_1"
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no uid found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        logger.info(f"VERIFIED: Token successfully verified for user: {uid}")
        return uid

    except firebaseAuth.RevokedIdTokenError:
        if DEV_MODE:
            logger.warning("DEV MODE: Token revoked. Using fallback user: test_user_1")
            return "test_user_1"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebaseAuth.ExpiredIdTokenError:
        if DEV_MODE:
            logger.warning("DEV MODE: Token expired. Using fallback user: test_user_1")
            return "test_user_1"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        if DEV_MODE:
            logger.warning(f"DEV MODE: Token verification failed ({str(e)}). Using fallback user: test_user_1")
            return "test_user_1"
        logger.error(f"Token verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


def getCurrentUserDependency(authorization: Optional[str] = Header(None)) -> str:
    """Dependency injection function for FastAPI.

    Use this in route handlers with Depends():
    ```
    @router.get("/protected")
    async def protected_route(userId: str = Depends(getCurrentUserDependency)):
        ...
    ```
    """
    return getCurrentUser(authorization or "")

