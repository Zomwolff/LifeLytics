"""LLM Service using OpenRouter API with Fallback Models.

Handles integration with OpenRouter for advanced analytics and insights.
Uses model fallback chain to ensure reliability:
1. qwen/qwen3.6-plus:free (primary - fastest, free)
2. nvidia/nemotron-3-super-120b-a12b:free (fallback 1)
3. google/gemma-4-31b-it (fallback 2)

Features:
- Async HTTP calls with proper timeout handling
- Fallback models if primary fails
- No silent fallback to rule-based logic (explicit error reporting)
- Detailed logging for each model attempt
- Rate limiting to prevent excessive API usage
- Performance timing for monitoring
- Structured error responses with llm_used and model_used fields

Requirements:
- OPENROUTER_API_KEY environment variable
- httpx for async HTTP calls

Note: If all LLM models fail, returns structured error instead of silently falling back.
"""

import os
import json
import httpx
from typing import Dict, Any, Optional
import asyncio

from backend.utils.logger import getLogger, timeOperation, llmLogger
from backend.utils.rate_limiter import getLLMRateLimiter

logger = getLogger(__name__)
rateLimiter = getLLMRateLimiter()


class LLMService:
    """Async LLM service with fallback models and comprehensive error handling."""

    # Model fallback chain (primary -> fallback1 -> fallback2)
    MODELS = [
        "qwen/qwen3.6-plus:free",  # Primary: fastest, cost-effective
        "nvidia/nemotron-3-super-120b-a12b:free",  # Fallback 1: alternative
        "google/gemma-4-31b-it",  # Fallback 2: last resort
    ]

    def __init__(self):
        """Initialize LLM service with OpenRouter API key and model chain."""
        self.apiKey = os.getenv("OPENROUTER_API_KEY")
        self.baseUrl = "https://openrouter.ai/api/v1/chat/completions"
        # Timeout: connect=10s, read=20s (for LLM inference time)
        self.timeout = httpx.Timeout(10.0, read=20.0)
        self.maxRetriesPerModel = 1  # Retry each model once on transient errors

        if self.apiKey:
            llmLogger.info("LLM service initialized with API key configured")
        else:
            llmLogger.warning("OPENROUTER_API_KEY not set - LLM features will be unavailable")

    async def generateInsights(self, structuredData: Dict[str, Any], userId: str = "unknown") -> Dict[str, Any]:
        """Generate enhanced insights using LLM with model fallback and rate limiting.

        Process:
        1. Check rate limiting
        2. Try primary model (qwen/qwen3.6-plus:free)
        3. If fails, try fallback models in sequence
        4. Return insights with llm_used and model_used fields
        5. If all models fail, return explicit error (never silently fallback)

        Args:
            structuredData: Rule-based insights and user health data
            userId: User ID for rate limiting and logging

        Returns:
            Dict with:
            - insights, risks, recommendations, health_score (from rule-based or LLM)
            - llm_used: bool (True if LLM was successful)
            - model_used: str or None (model name if LLM successful)
            - llm_status: "success" or "failed" (only if LLM attempted)
        """
        # Check rate limit
        allowed, stats = rateLimiter.isAllowed(f"insights_{userId}")
        if not allowed:
            llmLogger.warning(
                f"Rate limit exceeded for user {userId}. "
                f"Remaining: {stats['remaining']}, Reset in: {stats['resetIn']}s"
            )
            return self._createRuleBasedResponse(
                structuredData, llmUsed=False, modelUsed=None, llmStatus=None
            )

        if not self.apiKey:
            llmLogger.warning(f"No API key configured for user {userId}, LLM unavailable")
            return self._createRuleBasedResponse(
                structuredData, llmUsed=False, modelUsed=None, llmStatus="failed", error="API key not configured"
            )

        prompt = self._buildInsightsPrompt(structuredData)

        with timeOperation(f"LLM insights generation for user {userId}") as timer:
            # Try each model in sequence
            for modelIndex, model in enumerate(self.MODELS, 1):
                llmLogger.info(f"Attempting model {modelIndex}/{len(self.MODELS)}: {model}")
                try:
                    result = await self._callLLMWithRetry(prompt, model)
                    if result:
                        llmLogger.info(
                            f"SUCCESS: LLM generated insights for user {userId} using {model} "
                            f"in {timer.elapsed:.2f}s"
                        )
                        parsed = self._parseInsightsResponse(result, structuredData, model)
                        return parsed
                    else:
                        llmLogger.warning(f"Model {model} returned empty response")
                        # Continue to next model

                except asyncio.TimeoutError:
                    llmLogger.error(
                        f"TIMEOUT: Model {model} timeout for user {userId} after {timer.elapsed:.2f}s"
                    )
                    if modelIndex < len(self.MODELS):
                        llmLogger.info(f"Trying next model...")
                        continue
                    else:
                        # All models failed with timeout
                        llmLogger.error(f"All models timed out for user {userId}")
                        return self._createRuleBasedResponse(
                            structuredData,
                            llmUsed=False,
                            modelUsed=None,
                            llmStatus="failed",
                            error="All LLM models timed out"
                        )

                except Exception as e:
                    llmLogger.error(f"ERROR with model {model}: {str(e)}")
                    if modelIndex < len(self.MODELS):
                        llmLogger.info(f"Trying next model...")
                        continue
                    else:
                        # All models failed
                        llmLogger.error(f"All LLM models failed for user {userId}: {str(e)}")
                        return self._createRuleBasedResponse(
                            structuredData,
                            llmUsed=False,
                            modelUsed=None,
                            llmStatus="failed",
                            error=f"All models failed: {str(e)}"
                        )

            # If we reach here, all models returned empty responses
            llmLogger.error(f"All LLM models returned empty responses for user {userId}")
            return self._createRuleBasedResponse(
                structuredData,
                llmUsed=False,
                modelUsed=None,
                llmStatus="failed",
                error="All models returned empty responses"
            )

    async def _callLLMWithRetry(self, prompt: str, model: str, retryCount: int = 0) -> Optional[str]:
        """Call LLM API with specified model and automatic retry on transient errors.

        Args:
            prompt: Prompt to send to LLM
            model: Model name from MODELS list
            retryCount: Current retry attempt (internal use)

        Returns:
            LLM response or None if call failed
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                llmLogger.debug(f"Sending request to {model} (attempt {retryCount + 1})")
                response = await client.post(
                    self.baseUrl,
                    headers={
                        "Authorization": f"Bearer {self.apiKey}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a professional health analytics assistant. "
                                          "Respond ONLY with valid JSON, no additional text."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1500,
                    },
                    timeout=self.timeout,
                )

                llmLogger.debug(f"Response status: {response.status_code}")

                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    llmLogger.debug(f"Received response from {model}")
                    return content

                elif response.status_code == 429:
                    # Rate limited by API
                    llmLogger.warning(f"Rate limited by OpenRouter on model {model}")
                    if retryCount < self.maxRetriesPerModel:
                        waitTime = (retryCount + 1) * 2
                        llmLogger.info(f"Waiting {waitTime}s before retry...")
                        await asyncio.sleep(waitTime)
                        return await self._callLLMWithRetry(prompt, model, retryCount + 1)
                    else:
                        return None

                elif response.status_code == 401:
                    llmLogger.error("Authentication failed: Invalid API key")
                    return None

                elif response.status_code == 500 and retryCount < self.maxRetriesPerModel:
                    # Server error, retry
                    llmLogger.warning(f"OpenRouter server error ({response.status_code}), retrying...")
                    await asyncio.sleep(1)
                    return await self._callLLMWithRetry(prompt, model, retryCount + 1)

                else:
                    llmLogger.error(f"LLM API error - Status: {response.status_code}, Message: {response.text}")
                    return None

        except asyncio.TimeoutError:
            llmLogger.error(f"Timeout on {model}")
            raise

        except Exception as e:
            llmLogger.error(f"Error calling {model}: {str(e)}")
            return None

    async def generateChatResponse(self, message: str, userContext: Dict[str, Any], userId: str = "unknown") -> Dict[str, Any]:
        """Generate intelligent chatbot response with model fallback and rate limiting.

        Args:
            message: User message
            userContext: User health data for context
            userId: User ID for rate limiting and logging

        Returns:
            Dict with:
            - response: str (AI response)
            - llm_used: bool
            - model_used: str or None
            - llm_status: "success" or "failed"
        """
        # Check rate limit (separate from insights)
        allowed, stats = rateLimiter.isAllowed(f"chat_{userId}")
        if not allowed:
            llmLogger.warning(f"Chat rate limit exceeded for user {userId}")
            return {
                "response": self._mockChatResponse(message),
                "llm_used": False,
                "model_used": None,
                "llm_status": "rate_limited"
            }

        if not self.apiKey:
            return {
                "response": self._mockChatResponse(message),
                "llm_used": False,
                "model_used": None,
                "llm_status": "api_key_missing"
            }

        prompt = self._buildChatPrompt(message, userContext)

        with timeOperation(f"LLM chat for user {userId}") as timer:
            # Try each model in sequence
            for modelIndex, model in enumerate(self.MODELS, 1):
                llmLogger.info(f"Attempting chat with model {modelIndex}/{len(self.MODELS)}: {model}")
                try:
                    result = await self._callLLMWithRetry(prompt, model)
                    if result:
                        llmLogger.info(f"Generated chat response for user {userId} using {model} in {timer.elapsed:.2f}s")
                        return {
                            "response": result,
                            "llm_used": True,
                            "model_used": model,
                            "llm_status": "success"
                        }

                except asyncio.TimeoutError:
                    llmLogger.error(f"Chat timeout with {model} for user {userId}")
                    if modelIndex < len(self.MODELS):
                        continue
                    else:
                        llmLogger.error(f"All chat models timed out for user {userId}")
                        return {
                            "response": self._mockChatResponse(message),
                            "llm_used": False,
                            "model_used": None,
                            "llm_status": "failed",
                            "error": "All models timed out"
                        }

                except Exception as e:
                    llmLogger.error(f"Chat error with {model}: {str(e)}")
                    if modelIndex < len(self.MODELS):
                        continue
                    else:
                        return {
                            "response": self._mockChatResponse(message),
                            "llm_used": False,
                            "model_used": None,
                            "llm_status": "failed",
                            "error": str(e)
                        }

            # All models failed
            llmLogger.error(f"All chat models failed for user {userId}")
            return {
                "response": self._mockChatResponse(message),
                "llm_used": False,
                "model_used": None,
                "llm_status": "failed",
                "error": "All models returned empty responses"
            }


    def _buildInsightsPrompt(self, data: Dict[str, Any]) -> str:
        """Build detailed prompt for insights generation with JSON output requirement.

        Structured to provide health context and force JSON response.
        """
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

    def _buildChatPrompt(self, message: str, userContext: Dict[str, Any]) -> str:
        """Build detailed prompt for chatbot response with health context."""
        metrics = userContext.get("metrics", {})
        return f"""You are a professional health assistant chatbot. Answer health questions based on the user's data.
Be conversational, accurate, and helpful. Provide actionable advice when relevant.

USER'S CURRENT HEALTH PROFILE:
- Height: {metrics.get('height', 'N/A')} m
- Weight: {metrics.get('weight', 'N/A')} kg
- BMI: {metrics.get('bmi', 'N/A')}
- Average Sleep: {metrics.get('avgSleep', 'N/A')} hours/day
- Average Steps: {metrics.get('avgSteps', 'N/A')} steps/day
- Average Glucose: {metrics.get('avgGlucose', 'N/A')} mg/dL
- Average Heart Rate: {metrics.get('avgHeartRate', 'N/A')} bpm

USER QUESTION: {message}

Provide a helpful, conversational response. Be specific and reference the user's health data when relevant.
If discussing medical conditions, remind user to consult healthcare providers for medical advice."""

    def _parseInsightsResponse(self, llmResponse: str, originalData: Dict[str, Any], model: str) -> Dict[str, Any]:
        """Parse LLM insights response and combine with rule-based data.

        Args:
            llmResponse: Raw LLM response text
            originalData: Original rule-based insights data
            model: Model used for generation

        Returns:
            Parsed insights dictionary with llm_used and model_used fields
        """
        try:
            # Extract JSON from response (handle markdown code blocks)
            jsonStr = llmResponse.strip()
            if "```json" in jsonStr:
                jsonStr = jsonStr.split("```json")[1].split("```")[0].strip()
            elif "```" in jsonStr:
                jsonStr = jsonStr.split("```")[1].split("```")[0].strip()

            # Parse JSON
            parsed = json.loads(jsonStr)
            llmLogger.info(f"Successfully parsed LLM insights response from {model}")

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

        except json.JSONDecodeError as e:
            llmLogger.error(f"Failed to parse JSON from {model}: {str(e)}")
            # Return rule-based with error indication
            return self._createRuleBasedResponse(
                originalData,
                llmUsed=False,
                modelUsed=model,
                llmStatus="failed",
                error=f"JSON parse error: {str(e)}"
            )

        except Exception as e:
            llmLogger.error(f"Error processing LLM response from {model}: {str(e)}")
            return self._createRuleBasedResponse(
                originalData,
                llmUsed=False,
                modelUsed=model,
                llmStatus="failed",
                error=str(e)
            )

    def _createRuleBasedResponse(
        self,
        data: Dict[str, Any],
        llmUsed: bool = False,
        modelUsed: Optional[str] = None,
        llmStatus: Optional[str] = None,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create response object with rule-based insights and LLM status fields.

        Args:
            data: Rule-based insights data
            llmUsed: Whether LLM was successfully used
            modelUsed: Which model was used (if any)
            llmStatus: Status of LLM attempt (success, failed, rate_limited, etc.)
            error: Error message if LLM failed

        Returns:
            Response dict with insights and metadata
        """
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
        """Mock chat response if LLM is unavailable."""
        keyword = message.lower()
        if "bmi" in keyword:
            return "You can check your BMI at the /health/bmi endpoint. BMI helps assess if you're at a healthy weight for your height."
        elif "glucose" in keyword or "blood sugar" in keyword:
            return "Glucose monitoring is important for managing diabetes risk. Regular readings help identify patterns and trends."
        elif "exercise" in keyword or "workout" in keyword:
            return "Regular exercise is crucial for overall health. Aim for at least 150 minutes of moderate activity per week."
        elif "nutrition" in keyword or "diet" in keyword:
            return "A balanced diet with fruits, vegetables, whole grains, and lean proteins supports optimal health."
        else:
            return "I can help with health-related questions. Try asking about BMI, glucose, exercise, or nutrition."


# Global instance
_llmService: Optional[LLMService] = None


def getLLMService() -> LLMService:
    """Get or create LLM service instance."""
    global _llmService
    if _llmService is None:
        _llmService = LLMService()
    return _llmService
