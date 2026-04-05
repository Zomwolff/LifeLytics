"""Caching utility for optimization.

Stores cached data with expiration times to reduce repeated calculations
and API calls.
"""

import time
from typing import Dict, Any, Optional


class CacheEntry:
    """Represents a cached entry with expiration."""

    def __init__(self, data: Any, ttlSeconds: int = 1800):
        """Initialize cache entry.

        Args:
            data: Data to cache
            ttlSeconds: Time to live in seconds (default 30 minutes)
        """
        self.data = data
        self.expiresAt = time.time() + ttlSeconds
        self.createdAt = time.time()

    def isExpired(self) -> bool:
        """Check if cache entry has expired."""
        return time.time() > self.expiresAt

    def getAge(self) -> float:
        """Get age of cache entry in seconds."""
        return time.time() - self.createdAt


class Cache:
    """Simple in-memory cache with TTL support."""

    def __init__(self):
        """Initialize cache."""
        self._store: Dict[str, CacheEntry] = {}

    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired.

        Args:
            key: Cache key

        Returns:
            Cached data or None if expired/not found
        """
        if key not in self._store:
            return None

        entry = self._store[key]
        if entry.isExpired():
            del self._store[key]
            return None

        return entry.data

    def set(self, key: str, data: Any, ttlSeconds: int = 1800) -> None:
        """Set cache value with TTL.

        Args:
            key: Cache key
            data: Data to cache
            ttlSeconds: Time to live in seconds
        """
        self._store[key] = CacheEntry(data, ttlSeconds)

    def delete(self, key: str) -> None:
        """Delete cache entry.

        Args:
            key: Cache key
        """
        if key in self._store:
            del self._store[key]

    def clearExpired(self) -> None:
        """Remove all expired entries from cache."""
        expiredKeys = [
            key for key, entry in self._store.items() if entry.isExpired()
        ]
        for key in expiredKeys:
            del self._store[key]

    def clear(self) -> None:
        """Clear entire cache."""
        self._store.clear()

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        self.clearExpired()
        return {
            "total_entries": len(self._store),
            "keys": list(self._store.keys()),
        }


# Global cache instance
_cache = Cache()


def getCache() -> Cache:
    """Get global cache instance."""
    return _cache
