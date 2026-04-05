"""Logging setup for the backend.

Configures logging for tracking LLM usage, errors, and performance metrics.
"""

import logging
import time
from typing import Optional
from contextlib import contextmanager


# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Get logger for backend
logger = logging.getLogger("backend")


def getLogger(name: str) -> logging.Logger:
    """Get a logger instance for a module.

    Args:
        name: Module name (typically __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)


class PerformanceTimer:
    """Context manager for measuring performance."""

    def __init__(self, name: str, logger_instance: Optional[logging.Logger] = None):
        """Initialize timer.

        Args:
            name: Timer name for logging
            logger_instance: Logger to use (defaults to backend logger)
        """
        self.name = name
        self.logger = logger_instance or logger
        self.startTime: Optional[float] = None
        self.elapsed: float = 0

    def __enter__(self) -> "PerformanceTimer":
        """Start timer."""
        self.startTime = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Stop timer and log elapsed time."""
        if self.startTime:
            self.elapsed = time.time() - self.startTime
            if exc_type:
                self.logger.error(
                    f"{self.name} took {self.elapsed:.2f}s (failed with {exc_type.__name__})"
                )
            else:
                self.logger.info(f"{self.name} took {self.elapsed:.2f}s")


@contextmanager
def timeOperation(name: str, logger_instance: Optional[logging.Logger] = None):
    """Context manager for timing operations.

    Usage:
        with timeOperation("API call") as timer:
            # do work
            pass
        # timer.elapsed contains elapsed time in seconds
    """
    timer = PerformanceTimer(name, logger_instance)
    with timer:
        yield timer


# Specialized loggers
llmLogger = getLogger("backend.llm")
authLogger = getLogger("backend.auth")
dbLogger = getLogger("backend.database")
apiLogger = getLogger("backend.api")
