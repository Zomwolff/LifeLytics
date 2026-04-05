"""Rate limiting utility to prevent excessive API calls.

Implements per-user rate limiting for expensive operations like LLM calls.
"""

import time
from typing import Dict, List, Tuple
from threading import Lock


class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, maxRequests: int = 10, windowSeconds: int = 3600):
        """Initialize rate limiter.

        Args:
            maxRequests: Maximum requests allowed per window
            windowSeconds: Time window in seconds (default 1 hour)
        """
        self.maxRequests = maxRequests
        self.windowSeconds = windowSeconds
        self._requests: Dict[str, List[float]] = {}
        self._lock = Lock()

    def isAllowed(self, key: str) -> Tuple[bool, Dict[str, int]]:
        """Check if request is allowed under rate limit.

        Args:
            key: Rate limit key (e.g., user_id)

        Returns:
            Tuple of (allowed: bool, stats: {remaining, resetIn})
        """
        with self._lock:
            now = time.time()

            # Initialize if not exists
            if key not in self._requests:
                self._requests[key] = []

            # Remove old requests outside window
            self._requests[key] = [
                timestamp
                for timestamp in self._requests[key]
                if now - timestamp < self.windowSeconds
            ]

            # Check if allowed
            currentCount = len(self._requests[key])
            if currentCount < self.maxRequests:
                self._requests[key].append(now)
                remaining = self.maxRequests - currentCount - 1
                stats = {"remaining": remaining, "resetIn": self.windowSeconds}
                return True, stats
            else:
                # Calculate when reset happens
                oldestRequest = self._requests[key][0]
                resetIn = int(self.windowSeconds - (now - oldestRequest))
                stats = {"remaining": 0, "resetIn": max(1, resetIn)}
                return False, stats

    def reset(self, key: str) -> None:
        """Reset rate limit for a key.

        Args:
            key: Rate limit key
        """
        with self._lock:
            if key in self._requests:
                del self._requests[key]

    def stats(self, key: str) -> Dict[str, int]:
        """Get rate limit stats for a key.

        Args:
            key: Rate limit key

        Returns:
            Stats dictionary with remaining requests and reset time
        """
        with self._lock:
            if key not in self._requests:
                return {"remaining": self.maxRequests, "resetIn": self.windowSeconds}

            now = time.time()
            self._requests[key] = [
                timestamp
                for timestamp in self._requests[key]
                if now - timestamp < self.windowSeconds
            ]

            currentCount = len(self._requests[key])
            remaining = self.maxRequests - currentCount

            if currentCount == 0:
                return {"remaining": remaining, "resetIn": self.windowSeconds}

            oldestRequest = self._requests[key][0]
            resetIn = int(self.windowSeconds - (now - oldestRequest))

            return {"remaining": max(0, remaining), "resetIn": max(1, resetIn)}


# Global rate limiters
_llmCallLimiter = RateLimiter(maxRequests=10, windowSeconds=3600)  # 10 calls/hour
_insightLimiter = RateLimiter(maxRequests=5, windowSeconds=1800)  # 5 calls/30min


def getLLMRateLimiter() -> RateLimiter:
    """Get global LLM call rate limiter."""
    return _llmCallLimiter


def getInsightRateLimiter() -> RateLimiter:
    """Get global insight generation rate limiter."""
    return _insightLimiter
