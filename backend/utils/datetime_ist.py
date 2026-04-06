"""Timezone helpers for India Standard Time (Asia/Kolkata)."""

from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """Return timezone-aware current datetime in IST."""
    return datetime.now(IST)


def today_ist() -> str:
    """Return current date string in IST (YYYY-MM-DD)."""
    return now_ist().date().isoformat()
