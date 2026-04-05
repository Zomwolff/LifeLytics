"""Nutrition analysis routes.

Endpoints:
- POST /nutrition/analyze - Parse food description and return nutritional values
- POST /nutrition/save-meal - Save meal log to Firestore
- GET /nutrition/meals - Fetch meals for a specific date
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import re

from backend.utils import auth
from backend.utils.datetime_ist import now_ist, today_ist
from backend.utils.firebase import getFirestoreClient
from backend.services import llmService as llm

router = APIRouter()


class FoodAnalysisRequest(BaseModel):
    """Request to analyze food item."""
    description: str


class NutrientValue(BaseModel):
    """Single nutrient value."""
    name: str
    value: str


class FoodAnalysisResponse(BaseModel):
    """Response with nutritional analysis."""
    name: str
    servingSize: str
    calories: str
    protein: str
    totalFat: str
    saturatedFat: str
    cholesterol: str
    sodium: str
    carbohydrates: str
    fiber: str
    sugars: str


class SaveMealRequest(BaseModel):
    """Request to save a meal."""
    userId: str
    date: str
    meal: dict


class FetchMealsRequest(BaseModel):
    """Request to fetch meals."""
    userId: str
    date: str


# Mock food database for quick lookups
FOOD_DATABASE = {
    "paneer": {
        "name": "paneer",
        "servingSize": "100g",
        "calories": "299.8",
        "protein": "18g",
        "totalFat": "24g",
        "saturatedFat": "12.9g",
        "cholesterol": "70mg",
        "sodium": "751mg",
        "carbohydrates": "3g",
        "fiber": "0g",
        "sugars": "2g",
    },
    "chicken": {
        "name": "chicken breast",
        "servingSize": "100g",
        "calories": "165",
        "protein": "31.2g",
        "totalFat": "3.6g",
        "saturatedFat": "1g",
        "cholesterol": "85mg",
        "sodium": "74mg",
        "carbohydrates": "0g",
        "fiber": "0g",
        "sugars": "0g",
    },
    "rice": {
        "name": "white rice",
        "servingSize": "100g",
        "calories": "130",
        "protein": "2.7g",
        "totalFat": "0.3g",
        "saturatedFat": "0.1g",
        "cholesterol": "0mg",
        "sodium": "2mg",
        "carbohydrates": "28g",
        "fiber": "0.4g",
        "sugars": "0.1g",
    },
    "bread": {
        "name": "whole wheat bread",
        "servingSize": "100g",
        "calories": "247",
        "protein": "13.7g",
        "totalFat": "3.3g",
        "saturatedFat": "0.7g",
        "cholesterol": "0mg",
        "sodium": "486mg",
        "carbohydrates": "41g",
        "fiber": "6.8g",
        "sugars": "3.3g",
    },
    "apple": {
        "name": "apple",
        "servingSize": "100g",
        "calories": "52",
        "protein": "0.3g",
        "totalFat": "0.2g",
        "saturatedFat": "0g",
        "cholesterol": "0mg",
        "sodium": "2mg",
        "carbohydrates": "13.8g",
        "fiber": "2.4g",
        "sugars": "10.4g",
    },
    "egg": {
        "name": "egg",
        "servingSize": "100g",
        "calories": "155",
        "protein": "13g",
        "totalFat": "11g",
        "saturatedFat": "3.3g",
        "cholesterol": "373mg",
        "sodium": "124mg",
        "carbohydrates": "1.1g",
        "fiber": "0g",
        "sugars": "1.1g",
    },
    "milk": {
        "name": "milk (2%)",
        "servingSize": "100g",
        "calories": "61",
        "protein": "3.2g",
        "totalFat": "2.5g",
        "saturatedFat": "1.6g",
        "cholesterol": "10mg",
        "sodium": "44mg",
        "carbohydrates": "4.8g",
        "fiber": "0g",
        "sugars": "4.8g",
    },
}


def extractServingSize(description: str) -> float:
    """Extract numeric serving size from food description.
    
    Supports formats like "paneer 200g", "chicken 150g", etc.
    """
    match = re.search(r"(\d+(?:\.\d+)?)\s*(g|grams?|kg|oz|ml)", description, re.IGNORECASE)
    if match:
        amount = float(match.group(1))
        unit = match.group(2).lower()
        # Convert kg to g
        if "kg" in unit:
            amount *= 1000
        return amount
    return 100  # Default to 100g


def scaleMealNutrients(base: dict, scaleFactor: float) -> dict:
    """Scale nutritional values by serving size factor."""
    scaled = base.copy()
    
    # Scale numeric values
    def scaleValue(val_str: str) -> str:
        match = re.match(r"([\d.]+)", val_str)
        if match:
            base_val = float(match.group(1))
            scaled_val = base_val * (scaleFactor / 100)
            unit = val_str.replace(match.group(1), "").strip()
            return f"{scaled_val:.1f}{unit}"
        return val_str
    
    for key in ["calories", "protein", "totalFat", "saturatedFat", "cholesterol", "sodium", "carbohydrates", "fiber", "sugars"]:
        if key in scaled:
            scaled[key] = scaleValue(scaled[key])
    
    # Update serving size
    scaled["servingSize"] = f"{scaleFactor:.0f}g"
    
    return scaled


@router.post("/analyze")
async def analyzeFoodItem(
    payload: FoodAnalysisRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
) -> FoodAnalysisResponse:
    """Analyze a food description and return nutritional values.
    
    Process:
    1. Parse food description (e.g., "paneer sandwich 250g")
    2. Extract serving size from description
    3. Look up base nutritional values from database
    4. Scale values by serving size
    5. Return structured nutritional data
    
    Supports common Indian and international foods.
    Falls back to generic estimates if food not in database.
    """
    try:
        description = payload.description.strip().lower()
        servingSize = extractServingSize(description)
        
        # Find best matching food in database
        matched_food = None
        for keyword, food_data in FOOD_DATABASE.items():
            if keyword in description:
                matched_food = food_data.copy()
                break
        
        if not matched_food:
            # Fallback: generic food estimate
            matched_food = {
                "name": description,
                "servingSize": "100g",
                "calories": "150",
                "protein": "10g",
                "totalFat": "5g",
                "saturatedFat": "2g",
                "cholesterol": "20mg",
                "sodium": "300mg",
                "carbohydrates": "15g",
                "fiber": "1g",
                "sugars": "5g",
            }
        
        # Scale nutrients by serving size
        result = scaleMealNutrients(matched_food, servingSize)
        
        return FoodAnalysisResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Food analysis failed: {str(e)}")


@router.post("/save-meal")
async def saveMeal(
    payload: SaveMealRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Save a meal to Firestore database."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")

        today = today_ist()
        if payload.date != today:
            raise HTTPException(status_code=400, detail=f"You can only log meals for today ({today}).")
        
        # Verify user owns this data
        if userId != payload.userId:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Reference to user's meals collection
        meal_doc = {
            "date": today,
            "timestamp": payload.meal.get("timestamp", now_ist().isoformat()),
            "name": payload.meal.get("name"),
            "servingSize": payload.meal.get("servingSize"),
            "calories": payload.meal.get("calories"),
            "protein": payload.meal.get("protein"),
            "totalFat": payload.meal.get("totalFat"),
            "saturatedFat": payload.meal.get("saturatedFat"),
            "cholesterol": payload.meal.get("cholesterol"),
            "sodium": payload.meal.get("sodium"),
            "carbohydrates": payload.meal.get("carbohydrates"),
            "fiber": payload.meal.get("fiber"),
            "sugars": payload.meal.get("sugars"),
            "createdAt": now_ist().isoformat(),
        }
        
        # Save to Firestore
        db.collection("users").document(userId).collection("meals").add(meal_doc)
        
        return {"ok": True, "message": "Meal saved successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save meal: {str(e)}")


@router.get("/meals")
async def getMeals(
    date: str,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Fetch all meals for a specific date and user."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Query meals for the user and date
        meals_ref = db.collection("users").document(userId).collection("meals")
        query = meals_ref.where("date", "==", date)
        docs = query.stream()
        
        meals = []
        for doc in docs:
            meal_data = doc.to_dict()
            meals.append(meal_data)
        
        # Sort by timestamp
        meals.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return {"meals": meals}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch meals: {str(e)}")


@router.get("/summary")
async def getNutritionSummary(
    date: str,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Get daily nutrition summary (total calories, protein, etc.)."""
    try:
        db = getFirestoreClient()
        if not db:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Query meals for the user and date
        meals_ref = db.collection("users").document(userId).collection("meals")
        query = meals_ref.where("date", "==", date)
        docs = query.stream()
        
        meals = []
        for doc in docs:
            meals.append(doc.to_dict())
        
        # Calculate totals
        def extractNumber(val: str) -> float:
            """Extract numeric value from string like '100g' or '50.5'."""
            if isinstance(val, str):
                match = re.match(r"([\d.]+)", val)
                if match:
                    return float(match.group(1))
            try:
                return float(val)
            except:
                return 0.0
        
        totals = {
            "calories": 0,
            "protein": 0,
            "totalFat": 0,
            "saturatedFat": 0,
            "cholesterol": 0,
            "sodium": 0,
            "carbohydrates": 0,
            "fiber": 0,
            "sugars": 0,
        }
        
        for meal in meals:
            for key in totals.keys():
                totals[key] += extractNumber(meal.get(key, 0))
        
        return {
            "date": date,
            "mealCount": len(meals),
            "totalCalories": round(totals["calories"], 1),
            "totalProtein": round(totals["protein"], 1),
            "totalFat": round(totals["totalFat"], 1),
            "totalCarbs": round(totals["carbohydrates"], 1),
            "meals": meals,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary: {str(e)}")
