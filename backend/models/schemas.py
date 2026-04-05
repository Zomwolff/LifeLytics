"""Pydantic models and schemas for request/response validation.

These models ensure data consistency and provide API documentation.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List


# Health Metrics
class HeightRequest(BaseModel):
    """Height input (in meters)."""

    height: float = Field(..., gt=0, le=3, description="Height in meters (0 < h <= 3)")


class WeightRequest(BaseModel):
    """Weight input (in kilograms)."""

    weight: float = Field(..., gt=0, le=500, description="Weight in kg (0 < w <= 500)")


class BMIResponse(BaseModel):
    """BMI calculation result."""

    bmi: float


# Smartwatch Data
class SmartwatchData(BaseModel):
    """Wearable device data."""

    steps: Optional[int] = Field(None, ge=0, description="Step count")
    heartRate: Optional[int] = Field(None, ge=30, le=220, description="Heart rate (bpm)")
    caloriesBurned: Optional[float] = Field(None, ge=0, description="Calories burned")
    sleepDuration: Optional[float] = Field(None, ge=0, le=24, description="Sleep hours")
    activeMinutes: Optional[int] = Field(None, ge=0, description="Active minutes")
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        example = {
            "steps": 8500,
            "heartRate": 72,
            "caloriesBurned": 450.5,
            "sleepDuration": 7.5,
            "activeMinutes": 45,
        }


# Glucose Monitoring
class GlucoseReading(BaseModel):
    """Blood glucose reading."""

    glucoseLevel: Optional[float] = Field(
        None, ge=40, le=400, description="Glucose in mg/dL"
    )
    value: Optional[float] = Field(None, description="Alternative glucose field")
    unit: Optional[str] = Field("mg/dL", description="Measurement unit")
    timestamp: Optional[str] = None
    mealType: Optional[str] = Field(
        None, description="Before/after meal (fasting/postprandial)"
    )

    class Config:
        example = {
            "glucoseLevel": 95.5,
            "unit": "mg/dL",
            "mealType": "fasting",
        }


# Chat
class ChatRequest(BaseModel):
    """User message to chatbot."""

    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    """Chatbot response."""

    response: str


# Health Logs
class HealthLogEntry(BaseModel):
    """General health log entry."""

    logType: str
    value: float
    unit: Optional[str] = None
    notes: Optional[str] = None


# Insights
class InsightRequest(BaseModel):
    """Request health insights generation."""

    forceRefresh: Optional[bool] = False


class HealthInsight(BaseModel):
    """Individual health insight."""

    title: str
    description: str
    severity: Optional[str] = None  # low, medium, high


class HealthRecommendation(BaseModel):
    """Health recommendation."""

    title: str
    description: str
    priority: Optional[str] = None


class InsightResponse(BaseModel):
    """Generated health insights."""

    insights: List[str]
    risks: List[str]
    recommendations: List[str]
    healthScore: int = Field(..., ge=0, le=100)
    explanation: Optional[str] = None


# File Upload
class ReportResponse(BaseModel):
    """Parsed report result."""

    filename: str
    nutrients: Dict[str, str]
    metabolic_markers: Optional[Dict[str, str]] = None


# User Profile
class UserMetrics(BaseModel):
    """User health metrics summary."""

    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None


class UserHealthProfile(BaseModel):
    """Complete user health profile."""

    userId: str
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    glucose: List[Dict[str, Any]] = []
    smartwatch: List[Dict[str, Any]] = []
    healthLogs: List[Dict[str, Any]] = []

