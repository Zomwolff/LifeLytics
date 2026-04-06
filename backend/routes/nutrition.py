"""Nutrition analysis routes.

Endpoints:
- POST /nutrition/analyze - Parse food description and return nutritional values
- POST /nutrition/save-meal - Save meal log to Firestore
- GET /nutrition/meals - Fetch meals for a specific date
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import re
import os
import httpx
import csv
import json
from pathlib import Path

from backend.utils import auth
from backend.utils.datetime_ist import now_ist, today_ist
from backend.utils.firebase import getFirestoreClient
from backend.services import llmService as llm

router = APIRouter()

_NUTRITION_DATA_CACHE: list[dict] = []
_NUTRITION_DATA_CACHE_SIGNATURE: Optional[str] = None


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


class ImageFoodConfirmRequest(BaseModel):
    foodName: str
    servingGrams: Optional[float] = 100


def _extract_first_number(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"([\d.]+)", value)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                return 0.0
    return 0.0


def _normalize_nutrition_payload(raw: dict) -> dict:
    return {
        "name": raw.get("name", "food item"),
        "servingSize": raw.get("servingSize", "100g"),
        "calories": str(raw.get("calories", "0")),
        "protein": str(raw.get("protein", "0g")),
        "totalFat": str(raw.get("totalFat", "0g")),
        "saturatedFat": str(raw.get("saturatedFat", "0g")),
        "cholesterol": str(raw.get("cholesterol", "0mg")),
        "sodium": str(raw.get("sodium", "0mg")),
        "carbohydrates": str(raw.get("carbohydrates", "0g")),
        "fiber": str(raw.get("fiber", "0g")),
        "sugars": str(raw.get("sugars", "0g")),
    }


def _normalized_text(value: str) -> str:
    text = (value or "").lower().strip()
    # Normalize separators so "low-fat" and "low fat" are treated equally.
    text = re.sub(r"[-_/]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _extract_serving_grams(value: str) -> Optional[float]:
    if not value:
        return None
    match = re.search(r"([\d.]+)\s*(g|gram|grams)?", str(value).lower())
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _extract_field(row: dict, aliases: list[str], default: str = ""):
    for alias in aliases:
        normalized_alias = _normalize_key(alias)
        if normalized_alias in row and str(row[normalized_alias]).strip() != "":
            return row[normalized_alias]
    return default


def _normalize_key(value: str) -> str:
    key = str(value or "").strip().lower()
    key = re.sub(r"[^a-z0-9]+", "_", key)
    key = re.sub(r"_+", "_", key).strip("_")
    return key


def _resolve_nutrition_data_paths() -> list[Path]:
    configured = os.getenv("NUTRITION_DATA_PATH", "").strip()
    paths: list[Path] = []

    if configured:
        # Support one or many dataset paths separated by semicolon/comma.
        raw_paths = [part.strip() for part in re.split(r"[;,]", configured) if part.strip()]
        for raw_path in raw_paths:
            candidate = Path(raw_path)
            if candidate.exists() and candidate.is_file() and candidate.suffix.lower() in {".csv", ".tsv", ".json"}:
                paths.append(candidate)
        return paths

    project_root = Path(__file__).resolve().parents[2]
    data_dir = project_root / "backend" / "data"
    if not data_dir.exists():
        return []

    excluded = {
        "epi_r.csv",
        "full_format_recipes.json",
    }

    for file_path in sorted(data_dir.iterdir(), key=lambda p: p.name.lower()):
        if not file_path.is_file() or file_path.name in excluded:
            continue
        if file_path.suffix.lower() in {".csv", ".tsv", ".json"}:
            paths.append(file_path)

    return paths


def _parse_nutrition_rows(rows: list[dict]) -> list[dict]:
    parsed: list[dict] = []
    for row in rows:
        normalized_row = {_normalize_key(key): value for key, value in row.items()}

        name = str(_extract_field(normalized_row, ["name", "food", "food_name", "food_item", "item", "product_name", "dish_name", "description", "title"], "")).strip()
        if not name:
            continue

        serving_size = str(_extract_field(normalized_row, ["servingSize", "serving_size", "serving", "serving_g", "serving_unit", "serving_amount"], "100g"))
        if serving_size.isdigit():
            serving_size = f"{serving_size}g"

        # Prefer kcal-like columns first; if only kJ is present (common in OpenFoodFacts), convert to kcal.
        calories_value = _extract_first_number(
            _extract_field(
                normalized_row,
                ["calories", "kcal", "energy", "calories_kcal", "energy_kcal_100g", "energy_kcal"],
                "0",
            )
        )
        if calories_value <= 0:
            kj_value = _extract_first_number(
                _extract_field(normalized_row, ["energy_kj_100g", "energy_100g"], "0")
            )
            if kj_value > 0:
                calories_value = kj_value / 4.184

        calories = f"{calories_value:.1f}"
        protein = str(_extract_field(normalized_row, ["protein", "protein_g", "proteins_100g", "protein_g_", "protein_gm"], "0g"))
        total_fat = str(_extract_field(normalized_row, ["totalFat", "fat", "fat_g", "fats_g", "fat_100g", "total_fat"], "0g"))
        saturated_fat = str(_extract_field(normalized_row, ["saturatedFat", "sat_fat", "sat_fat_g", "saturated_fat_100g", "saturated_fat"], "0g"))
        cholesterol = str(_extract_field(normalized_row, ["cholesterol", "cholesterol_mg", "cholesterol_100g"], "0mg"))
        sodium = str(_extract_field(normalized_row, ["sodium", "sodium_mg", "sodium_100g"], "0mg"))
        carbohydrates = str(_extract_field(normalized_row, ["carbohydrates", "carbs", "carbs_g", "carbohydrates_g", "carbohydrates_100g"], "0g"))
        fiber = str(_extract_field(normalized_row, ["fiber", "fiber_g", "fibre_g", "fiber_100g", "fibre_100g"], "0g"))
        sugars = str(_extract_field(normalized_row, ["sugars", "sugar", "sugar_g", "free_sugar_g", "sugars_100g"], "0g"))

        # Skip rows without meaningful nutrition values.
        nutrition_signal = (
            _extract_first_number(calories)
            + _extract_first_number(protein)
            + _extract_first_number(total_fat)
            + _extract_first_number(carbohydrates)
        )
        if nutrition_signal <= 0:
            continue

        parsed.append(
            {
                "name": name,
                "nameNormalized": _normalized_text(name),
                "servingSize": serving_size,
                "calories": calories,
                "protein": protein,
                "totalFat": total_fat,
                "saturatedFat": saturated_fat,
                "cholesterol": cholesterol,
                "sodium": sodium,
                "carbohydrates": carbohydrates,
                "fiber": fiber,
                "sugars": sugars,
            }
        )
    return parsed


def _load_external_nutrition_data() -> list[dict]:
    global _NUTRITION_DATA_CACHE, _NUTRITION_DATA_CACHE_SIGNATURE

    paths = _resolve_nutrition_data_paths()
    if not paths:
        _NUTRITION_DATA_CACHE = []
        _NUTRITION_DATA_CACHE_SIGNATURE = None
        return []

    signature = "|".join(f"{path}:{path.stat().st_mtime}" for path in paths)
    if _NUTRITION_DATA_CACHE_SIGNATURE == signature:
        return _NUTRITION_DATA_CACHE

    all_rows: list[dict] = []
    for path in paths:
        rows: list[dict] = []
        suffix = path.suffix.lower()
        if suffix == ".csv":
            with path.open("r", encoding="utf-8", errors="ignore") as file:
                reader = csv.DictReader(file)
                rows = [dict(row) for row in reader]
        elif suffix == ".tsv":
            with path.open("r", encoding="utf-8", errors="ignore") as file:
                reader = csv.DictReader(file, delimiter="\t")
                rows = [dict(row) for row in reader]
        elif suffix == ".json":
            with path.open("r", encoding="utf-8", errors="ignore") as file:
                raw = json.load(file)
                if isinstance(raw, dict):
                    rows = list(raw.get("items") or raw.get("foods") or [])
                elif isinstance(raw, list):
                    rows = raw
        all_rows.extend(rows)

    parsed_rows = _parse_nutrition_rows(all_rows)

    # Deduplicate by normalized name, preferring rows with richer nutrition signal.
    dedup: dict[str, dict] = {}
    for row in parsed_rows:
        key = row.get("nameNormalized", "")
        if not key:
            continue
        current_signal = (
            _extract_first_number(row.get("calories", 0))
            + _extract_first_number(row.get("protein", 0))
            + _extract_first_number(row.get("totalFat", 0))
            + _extract_first_number(row.get("carbohydrates", 0))
        )

        existing = dedup.get(key)
        if not existing:
            dedup[key] = row
            continue

        existing_signal = (
            _extract_first_number(existing.get("calories", 0))
            + _extract_first_number(existing.get("protein", 0))
            + _extract_first_number(existing.get("totalFat", 0))
            + _extract_first_number(existing.get("carbohydrates", 0))
        )

        if current_signal > existing_signal:
            dedup[key] = row

    _NUTRITION_DATA_CACHE = list(dedup.values())
    _NUTRITION_DATA_CACHE_SIGNATURE = signature
    return _NUTRITION_DATA_CACHE


def _lookup_external_nutrition(description: str, serving_size: float) -> Optional[dict]:
    dataset = _load_external_nutrition_data()
    if not dataset:
        return None

    normalized_desc = _normalized_text(description)
    desc_tokens = set(normalized_desc.split())

    best_item: Optional[dict] = None
    best_score = -1.0

    for item in dataset:
        item_name = item.get("nameNormalized", "")
        if not item_name:
            continue

        item_tokens = [token for token in item_name.split() if token]
        if not item_tokens:
            continue

        matched = sum(1 for token in item_tokens if token in desc_tokens)
        substring_match = item_name in normalized_desc
        all_tokens_present = matched == len(item_tokens)

        score = 0.0
        if substring_match:
            score += 3.0
        if all_tokens_present:
            score += 2.0
        score += matched / len(item_tokens)
        score += min(len(item_name), 40) / 200.0

        if score > best_score and (substring_match or matched > 0):
            best_score = score
            best_item = item

    if not best_item:
        return None

    base_serving = _extract_serving_grams(best_item.get("servingSize", "")) or 100.0
    scale_factor = (serving_size / base_serving) * 100.0
    scaled = scaleMealNutrients(
        {
            "name": best_item.get("name", "food item"),
            "servingSize": f"{base_serving:.0f}g",
            "calories": best_item.get("calories", "0"),
            "protein": best_item.get("protein", "0g"),
            "totalFat": best_item.get("totalFat", "0g"),
            "saturatedFat": best_item.get("saturatedFat", "0g"),
            "cholesterol": best_item.get("cholesterol", "0mg"),
            "sodium": best_item.get("sodium", "0mg"),
            "carbohydrates": best_item.get("carbohydrates", "0g"),
            "fiber": best_item.get("fiber", "0g"),
            "sugars": best_item.get("sugars", "0g"),
        },
        max(scale_factor, 1.0),
    )
    return scaled


def _select_best_fallback_food(description: str) -> Optional[dict]:
    """Evaluate all fallback candidates and pick the best full-input match."""
    normalized_desc = _normalized_text(description)
    desc_tokens = set(normalized_desc.split())
    best_item = None
    best_score = -1.0

    for keyword, food_data in FOOD_DATABASE.items():
        normalized_key = _normalized_text(keyword)
        key_tokens = [token for token in normalized_key.split() if token]
        if not key_tokens:
            continue

        # Score each candidate by how well it matches the whole phrase.
        matched_tokens = sum(1 for token in key_tokens if token in desc_tokens)
        all_tokens_present = matched_tokens == len(key_tokens)
        substring_match = normalized_key in normalized_desc

        score = 0.0
        if substring_match:
            score += 3.0
        if all_tokens_present:
            score += 2.0

        # Token coverage rewards specific candidates when whole phrase is present.
        score += (matched_tokens / len(key_tokens))

        # Slightly prefer longer/more specific keys on ties.
        score += min(len(normalized_key), 40) / 200.0

        if score > best_score and (substring_match or matched_tokens > 0):
            best_score = score
            best_item = food_data.copy()

    return best_item


def _fallback_candidates_from_text(seed: str) -> List[dict]:
    token = (seed or "").lower()
    matches = []
    for key, item in FOOD_DATABASE.items():
        if key in token:
            matches.append({"name": item["name"], "confidence": 0.72})
    if matches:
        return matches[:3]
    return [
        {"name": "paneer", "confidence": 0.35},
        {"name": "chicken", "confidence": 0.33},
        {"name": "rice", "confidence": 0.30},
    ]


async def _detect_with_logmeal(file: UploadFile, image_bytes: bytes) -> List[dict]:
    api_key = os.getenv("LOGMEAL_API_KEY")
    if not api_key:
        return []

    endpoints = [
        "https://api.logmeal.com/v2/image/recognition/complete",
        "https://api.logmeal.com/v2/image/segmentation/complete",
    ]

    merged_candidates: dict[str, float] = {}

    for endpoint in endpoints:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"image": (file.filename or "meal.jpg", image_bytes, file.content_type or "image/jpeg")},
                )

            if response.status_code != 200:
                continue

            payload = response.json()
            items = payload.get("recognition_results") or payload.get("segmentation_results") or []
            for item in items:
                name = item.get("name") or item.get("foodName") or item.get("label")
                if not name:
                    continue
                confidence = _extract_first_number(item.get("prob") or item.get("confidence") or 0)
                if confidence > 1:
                    confidence = confidence / 100.0

                normalized_name = str(name).strip().lower()
                if normalized_name:
                    merged_candidates[normalized_name] = max(merged_candidates.get(normalized_name, 0.0), float(confidence))

            # Add optional dish-level predictions when available.
            for key in ["foodFamily", "dishName", "best_match"]:
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    normalized_name = value.strip().lower()
                    merged_candidates[normalized_name] = max(merged_candidates.get(normalized_name, 0.0), 0.5)
        except Exception:
            continue

    if not merged_candidates:
        return []

    ranked = sorted(merged_candidates.items(), key=lambda pair: pair[1], reverse=True)
    return [
        {"name": name.title(), "confidence": round(score, 2)}
        for name, score in ranked[:5]
    ]


async def _resolve_with_nutritionix(food_name: str, serving_grams: float) -> Optional[dict]:
    app_id = os.getenv("NUTRITIONIX_APP_ID")
    app_key = os.getenv("NUTRITIONIX_API_KEY")
    if not app_id or not app_key:
        return None

    try:
        query = f"{int(max(serving_grams, 1))}g {food_name}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://trackapi.nutritionix.com/v2/natural/nutrients",
                headers={
                    "x-app-id": app_id,
                    "x-app-key": app_key,
                    "Content-Type": "application/json",
                },
                json={"query": query},
            )
        if response.status_code != 200:
            return None

        payload = response.json()
        foods = payload.get("foods") or []
        if not foods:
            return None
        item = foods[0]
        return _normalize_nutrition_payload({
            "name": item.get("food_name", food_name),
            "servingSize": f"{int(max(serving_grams, 1))}g",
            "calories": round(_extract_first_number(item.get("nf_calories")), 1),
            "protein": f"{_extract_first_number(item.get('nf_protein')):.1f}g",
            "totalFat": f"{_extract_first_number(item.get('nf_total_fat')):.1f}g",
            "saturatedFat": f"{_extract_first_number(item.get('nf_saturated_fat')):.1f}g",
            "cholesterol": f"{_extract_first_number(item.get('nf_cholesterol')):.0f}mg",
            "sodium": f"{_extract_first_number(item.get('nf_sodium')):.0f}mg",
            "carbohydrates": f"{_extract_first_number(item.get('nf_total_carbohydrate')):.1f}g",
            "fiber": f"{_extract_first_number(item.get('nf_dietary_fiber')):.1f}g",
            "sugars": f"{_extract_first_number(item.get('nf_sugars')):.1f}g",
        })
    except Exception:
        return None


async def _resolve_with_openfoodfacts(food_name: str, serving_grams: float) -> Optional[dict]:
    """Free, no-key nutrition lookup using OpenFoodFacts."""
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://world.openfoodfacts.org/cgi/search.pl",
                params={
                    "search_terms": food_name,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page_size": 1,
                },
            )

        if response.status_code != 200:
            return None

        payload = response.json()
        products = payload.get("products") or []
        if not products:
            return None

        product = products[0]
        nutriments = product.get("nutriments") or {}
        scale = max(serving_grams, 1.0) / 100.0

        kcal_per_100g = _extract_first_number(
            nutriments.get("energy-kcal_100g")
            or nutriments.get("energy-kcal")
            or 0
        )
        if kcal_per_100g <= 0:
            # OFF often stores kJ only; convert to kcal.
            kj_per_100g = _extract_first_number(nutriments.get("energy-kj_100g") or nutriments.get("energy_100g") or 0)
            kcal_per_100g = kj_per_100g / 4.184 if kj_per_100g > 0 else 0

        sodium_raw = _extract_first_number(nutriments.get("sodium_100g") or 0)
        if sodium_raw <= 0:
            salt_raw = _extract_first_number(nutriments.get("salt_100g") or 0)
            sodium_raw = salt_raw * 0.393 if salt_raw > 0 else 0

        nutrition = {
            "name": product.get("product_name") or food_name,
            "servingSize": f"{int(max(serving_grams, 1))}g",
            "calories": round(kcal_per_100g * scale, 1),
            "protein": f"{_extract_first_number(nutriments.get('proteins_100g') or 0) * scale:.1f}g",
            "totalFat": f"{_extract_first_number(nutriments.get('fat_100g') or 0) * scale:.1f}g",
            "saturatedFat": f"{_extract_first_number(nutriments.get('saturated-fat_100g') or 0) * scale:.1f}g",
            "cholesterol": "0mg",
            "sodium": f"{(sodium_raw * 1000 * scale):.0f}mg",
            "carbohydrates": f"{_extract_first_number(nutriments.get('carbohydrates_100g') or 0) * scale:.1f}g",
            "fiber": f"{_extract_first_number(nutriments.get('fiber_100g') or 0) * scale:.1f}g",
            "sugars": f"{_extract_first_number(nutriments.get('sugars_100g') or 0) * scale:.1f}g",
        }

        if _extract_first_number(nutrition["calories"]) <= 0:
            return None

        return _normalize_nutrition_payload(nutrition)
    except Exception:
        return None


async def _resolve_with_usda(food_name: str, serving_grams: float) -> Optional[dict]:
    """USDA FoodData Central (free API key required)."""
    api_key = os.getenv("USDA_API_KEY")
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://api.nal.usda.gov/fdc/v1/foods/search",
                params={
                    "api_key": api_key,
                    "query": food_name,
                    "pageSize": 1,
                },
            )

        if response.status_code != 200:
            return None

        payload = response.json()
        foods = payload.get("foods") or []
        if not foods:
            return None

        food = foods[0]
        nutrients = food.get("foodNutrients") or []

        def nutrient_value(names: list[str]) -> float:
            names_lower = {name.lower() for name in names}
            for nutrient in nutrients:
                name = str(nutrient.get("nutrientName") or "").lower()
                if name in names_lower:
                    return _extract_first_number(nutrient.get("value"))
            return 0.0

        scale = max(serving_grams, 1.0) / 100.0
        nutrition = {
            "name": food.get("description") or food_name,
            "servingSize": f"{int(max(serving_grams, 1))}g",
            "calories": round(nutrient_value(["energy"]) * scale, 1),
            "protein": f"{nutrient_value(['protein']) * scale:.1f}g",
            "totalFat": f"{nutrient_value(['total lipid (fat)', 'fat']) * scale:.1f}g",
            "saturatedFat": f"{nutrient_value(['fatty acids, total saturated']) * scale:.1f}g",
            "cholesterol": f"{nutrient_value(['cholesterol']) * scale:.0f}mg",
            "sodium": f"{nutrient_value(['sodium, na']) * scale:.0f}mg",
            "carbohydrates": f"{nutrient_value(['carbohydrate, by difference']) * scale:.1f}g",
            "fiber": f"{nutrient_value(['fiber, total dietary']) * scale:.1f}g",
            "sugars": f"{nutrient_value(['sugars, total including nlea']) * scale:.1f}g",
        }

        if _extract_first_number(nutrition["calories"]) <= 0:
            return None

        return _normalize_nutrition_payload(nutrition)
    except Exception:
        return None


async def _resolve_with_edamam(food_name: str, serving_grams: float) -> Optional[dict]:
    app_id = os.getenv("EDAMAM_APP_ID")
    app_key = os.getenv("EDAMAM_APP_KEY")
    if not app_id or not app_key:
        return None

    try:
        query = f"{int(max(serving_grams, 1))} grams {food_name}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://api.edamam.com/api/nutrition-data",
                params={
                    "app_id": app_id,
                    "app_key": app_key,
                    "ingr": query,
                },
            )
        if response.status_code != 200:
            return None

        payload = response.json()
        total = payload.get("totalNutrients", {})
        return _normalize_nutrition_payload({
            "name": food_name,
            "servingSize": f"{int(max(serving_grams, 1))}g",
            "calories": round(_extract_first_number(payload.get("calories")), 1),
            "protein": f"{_extract_first_number((total.get('PROCNT') or {}).get('quantity')):.1f}g",
            "totalFat": f"{_extract_first_number((total.get('FAT') or {}).get('quantity')):.1f}g",
            "saturatedFat": f"{_extract_first_number((total.get('FASAT') or {}).get('quantity')):.1f}g",
            "cholesterol": f"{_extract_first_number((total.get('CHOLE') or {}).get('quantity')):.0f}mg",
            "sodium": f"{_extract_first_number((total.get('NA') or {}).get('quantity')):.0f}mg",
            "carbohydrates": f"{_extract_first_number((total.get('CHOCDF') or {}).get('quantity')):.1f}g",
            "fiber": f"{_extract_first_number((total.get('FIBTG') or {}).get('quantity')):.1f}g",
            "sugars": f"{_extract_first_number((total.get('SUGAR') or {}).get('quantity')):.1f}g",
        })
    except Exception:
        return None


async def _resolve_nutrition_with_providers(food_name: str, serving_grams: float) -> Optional[dict]:
    openfoodfacts_result = await _resolve_with_openfoodfacts(food_name, serving_grams)
    if openfoodfacts_result:
        return openfoodfacts_result

    usda_result = await _resolve_with_usda(food_name, serving_grams)
    if usda_result:
        return usda_result

    edamam_result = await _resolve_with_edamam(food_name, serving_grams)
    if edamam_result:
        return edamam_result

    nutritionix_result = await _resolve_with_nutritionix(food_name, serving_grams)
    if nutritionix_result:
        return nutritionix_result

    return None


# Mock food database for quick lookups
FOOD_DATABASE = {
    "deep fried chicken": {
        "name": "deep fried chicken",
        "servingSize": "100g",
        "calories": "295",
        "protein": "24g",
        "totalFat": "20g",
        "saturatedFat": "5.4g",
        "cholesterol": "95mg",
        "sodium": "420mg",
        "carbohydrates": "7g",
        "fiber": "0g",
        "sugars": "0g",
    },
    "fried chicken": {
        "name": "fried chicken",
        "servingSize": "100g",
        "calories": "285",
        "protein": "24g",
        "totalFat": "18g",
        "saturatedFat": "4.9g",
        "cholesterol": "92mg",
        "sodium": "390mg",
        "carbohydrates": "7g",
        "fiber": "0g",
        "sugars": "0g",
    },
    "chicken fry": {
        "name": "fried chicken",
        "servingSize": "100g",
        "calories": "285",
        "protein": "24g",
        "totalFat": "18g",
        "saturatedFat": "4.9g",
        "cholesterol": "92mg",
        "sodium": "390mg",
        "carbohydrates": "7g",
        "fiber": "0g",
        "sugars": "0g",
    },
    "low fat paneer": {
        "name": "low fat paneer",
        "servingSize": "100g",
        "calories": "145",
        "protein": "23g",
        "totalFat": "6g",
        "saturatedFat": "3.8g",
        "cholesterol": "28mg",
        "sodium": "320mg",
        "carbohydrates": "4g",
        "fiber": "0g",
        "sugars": "2g",
    },
    "paneer low fat": {
        "name": "low fat paneer",
        "servingSize": "100g",
        "calories": "145",
        "protein": "23g",
        "totalFat": "6g",
        "saturatedFat": "3.8g",
        "cholesterol": "28mg",
        "sodium": "320mg",
        "carbohydrates": "4g",
        "fiber": "0g",
        "sugars": "2g",
    },
    "low-fat paneer": {
        "name": "low fat paneer",
        "servingSize": "100g",
        "calories": "145",
        "protein": "23g",
        "totalFat": "6g",
        "saturatedFat": "3.8g",
        "cholesterol": "28mg",
        "sodium": "320mg",
        "carbohydrates": "4g",
        "fiber": "0g",
        "sugars": "2g",
    },
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
        resolved = await _analyze_description(payload.description)
        return FoodAnalysisResponse(**resolved)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Food analysis failed: {str(e)}")


async def _analyze_description(description: str) -> dict:
    cleaned = (description or "").strip().lower()
    if not cleaned:
        raise ValueError("Description is required")

    serving_size = extractServingSize(cleaned)

    # Highest priority: user-provided nutrition CSV/JSON dataset.
    external_match = _lookup_external_nutrition(cleaned, serving_size)
    if external_match:
        return external_match

    provider_result = await _resolve_nutrition_with_providers(cleaned, serving_size)
    if provider_result:
        # If input explicitly says fried/deep fried but provider resolves to generic chicken,
        # prefer specific fried fallback profile for better realism.
        normalized_input = _normalized_text(cleaned)
        normalized_provider_name = _normalized_text(str(provider_result.get("name", "")))
        asks_fried = "fried" in normalized_input or "deep fried" in normalized_input
        provider_is_nonfried_chicken = "chicken" in normalized_provider_name and "fried" not in normalized_provider_name
        if asks_fried and provider_is_nonfried_chicken:
            fried_fallback = _select_best_fallback_food("deep fried chicken")
            if fried_fallback:
                return scaleMealNutrients(fried_fallback, serving_size)
        return provider_result

    # Find best matching food in local fallback database after evaluating full input.
    matched_food = _select_best_fallback_food(cleaned)

    if not matched_food:
        matched_food = {
            "name": cleaned,
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

    return scaleMealNutrients(matched_food, serving_size)


@router.post("/image-detect")
async def detectFoodFromImage(
    file: UploadFile = File(...),
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Detect likely foods from an image and ask user to confirm one."""
    try:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Please upload an image file")

        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image file")

        candidates = await _detect_with_logmeal(file, image_bytes)
        if not candidates:
            candidates = _fallback_candidates_from_text(file.filename or "")

        return {
            "ok": True,
            "prompt": "I found possible matches. What food is this?",
            "candidates": candidates,
            "requiresConfirmation": True,
            "source": "logmeal" if os.getenv("LOGMEAL_API_KEY") else "fallback",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image detection failed: {str(e)}")


@router.post("/image-confirm")
async def confirmImageFood(
    payload: ImageFoodConfirmRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Resolve nutrition from confirmed food label and serving size."""
    try:
        food_name = (payload.foodName or "").strip()
        if not food_name:
            raise HTTPException(status_code=400, detail="foodName is required")

        grams = float(payload.servingGrams or 100)
        grams = max(1.0, min(2000.0, grams))

        provider_result = await _resolve_nutrition_with_providers(food_name, grams)
        if provider_result:
            return {"ok": True, "nutrition": provider_result, "source": "provider"}

        fallback_result = await _analyze_description(f"{food_name} {int(grams)}g")
        return {"ok": True, "nutrition": fallback_result, "source": "fallback"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Nutrition confirmation failed: {str(e)}")


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
