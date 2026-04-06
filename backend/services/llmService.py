"""LLM Service using OpenRouter API with Fallback Models."""

import os
import json
import httpx
from typing import Dict, Any, Optional, List
import asyncio

from backend.utils.logger import getLogger, timeOperation, llmLogger
from backend.utils.rate_limiter import getLLMRateLimiter

logger = getLogger(__name__)
rateLimiter = getLLMRateLimiter()


class LLMService:
    MODELS = [
        "qwen/qwen3.6-plus:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "google/gemma-4-31b-it",
    ]

    def __init__(self):
        self.apiKey = os.getenv("OPENROUTER_API_KEY")
        self.baseUrl = "https://openrouter.ai/api/v1/chat/completions"
        self.timeout = httpx.Timeout(10.0, read=30.0)
        self.maxRetriesPerModel = 1

        if self.apiKey:
            llmLogger.info("LLM service initialized with API key configured")
        else:
            llmLogger.warning("OPENROUTER_API_KEY not set - LLM features will be unavailable")

    # ── insights ──────────────────────────────────────────────────────────────

    async def generateInsights(self, structuredData: Dict[str, Any], userId: str = "unknown") -> Dict[str, Any]:
        allowed, stats = rateLimiter.isAllowed(f"insights_{userId}")
        if not allowed:
            return self._createRuleBasedResponse(structuredData, llmUsed=False, modelUsed=None, llmStatus=None)

        if not self.apiKey:
            return self._createRuleBasedResponse(
                structuredData, llmUsed=False, modelUsed=None,
                llmStatus="failed", error="API key not configured"
            )

        messages = [
            {"role": "system", "content": "You are a professional health analytics assistant. Respond ONLY with valid JSON, no additional text."},
            {"role": "user", "content": self._buildInsightsPrompt(structuredData)},
        ]

        with timeOperation(f"LLM insights for user {userId}") as timer:
            for modelIndex, model in enumerate(self.MODELS, 1):
                llmLogger.info(f"Attempting model {modelIndex}/{len(self.MODELS)}: {model}")
                try:
                    result = await self._callLLM(messages, model)
                    if result:
                        llmLogger.info(f"SUCCESS: insights via {model} in {timer.elapsed:.2f}s")
                        return self._parseInsightsResponse(result, structuredData, model)
                    llmLogger.warning(f"Model {model} returned empty response")
                except asyncio.TimeoutError:
                    llmLogger.error(f"TIMEOUT: {model}")
                    if modelIndex == len(self.MODELS):
                        return self._createRuleBasedResponse(structuredData, llmUsed=False, modelUsed=None, llmStatus="failed", error="All models timed out")
                except Exception as e:
                    llmLogger.error(f"ERROR with {model}: {e}")
                    if modelIndex == len(self.MODELS):
                        return self._createRuleBasedResponse(structuredData, llmUsed=False, modelUsed=None, llmStatus="failed", error=str(e))

            return self._createRuleBasedResponse(structuredData, llmUsed=False, modelUsed=None, llmStatus="failed", error="All models returned empty responses")

    # ── chat ──────────────────────────────────────────────────────────────────

    async def generateChatResponse(self, message: str, userContext: Dict[str, Any], userId: str = "unknown") -> Dict[str, Any]:
        allowed, stats = rateLimiter.isAllowed(f"chat_{userId}")
        if not allowed:
            return {"response": self._mockChatResponse(message), "llm_used": False, "model_used": None, "llm_status": "rate_limited"}

        if not self.apiKey:
            return {"response": self._mockChatResponse(message), "llm_used": False, "model_used": None, "llm_status": "api_key_missing"}

        messages = self._buildChatMessages(message, userContext)

        with timeOperation(f"LLM chat for user {userId}") as timer:
            for modelIndex, model in enumerate(self.MODELS, 1):
                llmLogger.info(f"Attempting chat model {modelIndex}/{len(self.MODELS)}: {model}")
                try:
                    result = await self._callLLM(messages, model, temperature=0.45, maxTokens=700)
                    if result:
                        llmLogger.info(f"Chat response via {model} in {timer.elapsed:.2f}s")
                        return {"response": result, "llm_used": True, "model_used": model, "llm_status": "success"}
                except asyncio.TimeoutError:
                    llmLogger.error(f"Chat timeout: {model}")
                    if modelIndex == len(self.MODELS):
                        return {"response": self._mockChatResponse(message), "llm_used": False, "model_used": None, "llm_status": "failed", "error": "All models timed out"}
                except Exception as e:
                    llmLogger.error(f"Chat error {model}: {e}")
                    if modelIndex == len(self.MODELS):
                        return {"response": self._mockChatResponse(message), "llm_used": False, "model_used": None, "llm_status": "failed", "error": str(e)}

            return {"response": self._mockChatResponse(message), "llm_used": False, "model_used": None, "llm_status": "failed", "error": "All models returned empty responses"}

    # ── core HTTP call ─────────────────────────────────────────────────────────

    async def _callLLM(
        self,
        messages: List[Dict[str, str]],
        model: str,
        retryCount: int = 0,
        temperature: float = 0.7,
        maxTokens: int = 1500,
    ) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.baseUrl,
                    headers={
                        "Authorization": f"Bearer {self.apiKey}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": maxTokens,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]

                elif response.status_code == 429:
                    if retryCount < self.maxRetriesPerModel:
                        await asyncio.sleep((retryCount + 1) * 2)
                        return await self._callLLM(messages, model, retryCount + 1, temperature, maxTokens)
                    return None

                elif response.status_code == 401:
                    llmLogger.error("Authentication failed: Invalid API key")
                    return None

                elif response.status_code == 500 and retryCount < self.maxRetriesPerModel:
                    await asyncio.sleep(1)
                    return await self._callLLM(messages, model, retryCount + 1, temperature, maxTokens)

                else:
                    llmLogger.error(f"LLM API error {response.status_code}: {response.text}")
                    return None

        except asyncio.TimeoutError:
            raise
        except Exception as e:
            llmLogger.error(f"Error calling {model}: {e}")
            return None

    # ── prompt builders ────────────────────────────────────────────────────────

    def _buildChatMessages(self, message: str, userContext: Dict[str, Any]) -> List[Dict[str, str]]:
        metrics = userContext.get("metrics", {})
        prescriptionContext = userContext.get("prescriptionContext", "No report history.")
        chatHistory: List[Dict[str, str]] = userContext.get("chatHistory", [])

        systemPrompt = f"""You are LifeLytics, a supportive and practical health coach.
Write in plain conversational English. Keep answers specific and useful.
When user health metrics are available, reference them naturally.
Always include 2-4 concrete next steps the user can do today.
If symptoms could be serious, add a short safety line advising medical care.
Avoid generic filler, avoid repeating the user message, and do not output JSON.

USER HEALTH PROFILE:
- Height: {metrics.get('height', 'N/A')} m
- Weight: {metrics.get('weight', 'N/A')} kg
- BMI: {metrics.get('bmi', 'N/A')}
- Avg Sleep: {metrics.get('avgSleep', 'N/A')} h/day
- Avg Steps: {metrics.get('avgSteps', 'N/A')} steps/day
- Avg Glucose: {metrics.get('avgGlucose', 'N/A')} mg/dL
- Avg Heart Rate: {metrics.get('avgHeartRate', 'N/A')} bpm
- Avg Calories Intake: {metrics.get('avgCaloriesIntake', 'N/A')} kcal/day
- Data Points: {metrics.get('dataPoints', 0)}

PRESCRIPTION & REPORT HISTORY:
{prescriptionContext}"""

        messages = [{"role": "system", "content": systemPrompt}]

        for turn in chatHistory[-10:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})
        return messages

    def _buildInsightsPrompt(self, data: Dict[str, Any]) -> str:
        summary = data.get("llm_summary", {})
        return f"""Analyze this user health profile and provide professional health insights.

SUMMARIZED HEALTH DATA:
- avg_sleep: {summary.get('avg_sleep', 'N/A')}
- avg_steps: {summary.get('avg_steps', 'N/A')}
- avg_glucose: {summary.get('avg_glucose', 'N/A')}
- avg_calories_intake: {summary.get('avg_calories_intake', 'N/A')}
- avg_calories_burned: {summary.get('avg_calories_burned', 'N/A')}
- avg_protein: {summary.get('avg_protein', 'N/A')}
- trend_summary: {summary.get('trend_summary', 'N/A')}
- data_points: {summary.get('data_points', 'N/A')}

PROVIDED ANALYSIS:
Insights: {data.get('insights', [])}
Current Risks: {data.get('risks', [])}
Recommendations: {data.get('recommendations', [])}
Health Score: {data.get('healthScore', 0)}

TASK:
1. Validate and enhance the provided insights
2. Identify potential health risks based on metrics
3. Provide specific, actionable recommendations
4. Calculate an overall health score (0-100)
5. Give a brief professional explanation

IMPORTANT: Respond ONLY with valid JSON. Use this exact structure:
{{
  "insights": ["insight1", "insight2", "insight3"],
  "risks": ["risk1", "risk2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "healthScore": 75,
  "explanation": "Professional summary of findings and health status"
}}

Ensure all fields are present and valid. No additional text outside JSON."""

    # ── parsers & fallbacks ────────────────────────────────────────────────────

    def _parseInsightsResponse(self, llmResponse: str, originalData: Dict[str, Any], model: str) -> Dict[str, Any]:
        try:
            jsonStr = llmResponse.strip()
            if "```json" in jsonStr:
                jsonStr = jsonStr.split("```json")[1].split("```")[0].strip()
            elif "```" in jsonStr:
                jsonStr = jsonStr.split("```")[1].split("```")[0].strip()

            parsed = json.loads(jsonStr)
            return {
                "insights": parsed.get("insights", []),
                "risks": parsed.get("risks", []),
                "recommendations": parsed.get("recommendations", []),
                "healthScore": parsed.get("healthScore", 50),
                "explanation": parsed.get("explanation", ""),
                "metrics": originalData.get("metrics", {}),
                "llm_used": True,
                "model_used": model,
                "llm_status": "success",
            }
        except Exception as e:
            llmLogger.error(f"Failed to parse insights JSON from {model}: {e}")
            return self._createRuleBasedResponse(originalData, llmUsed=False, modelUsed=model, llmStatus="failed", error=str(e))

    def _createRuleBasedResponse(self, data, llmUsed=False, modelUsed=None, llmStatus=None, error=None):
        response = {
            "insights": data.get("insights", []),
            "risks": data.get("risks", []),
            "recommendations": data.get("recommendations", []),
            "healthScore": data.get("healthScore", 50),
            "metrics": data.get("metrics", {}),
            "llm_used": llmUsed,
            "model_used": modelUsed,
        }
        if llmStatus:
            response["llm_status"] = llmStatus
        if error:
            response["llm_error"] = error
        return response

    def _mockChatResponse(self, message: str) -> str:
        keyword = message.lower()
        if "bmi" in keyword:
            return "BMI helps assess if you're at a healthy weight for your height."
        if "glucose" in keyword or "blood sugar" in keyword:
            return "Glucose monitoring is important for managing diabetes risk."
        if "exercise" in keyword or "workout" in keyword:
            return "Aim for at least 150 minutes of moderate activity per week."
        if "nutrition" in keyword or "diet" in keyword:
            return "A balanced diet with fruits, vegetables, whole grains, and lean proteins supports optimal health."
        return "I can help with health-related questions about BMI, glucose, exercise, nutrition, or your reports."


_llmService: Optional[LLMService] = None


def getLLMService() -> LLMService:
    global _llmService
    if _llmService is None:
        _llmService = LLMService()
    return _llmService
