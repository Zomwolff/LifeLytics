"""AI chatbot routes.

Endpoints:
- POST /chatbot - Send message to chatbot
"""

from fastapi import APIRouter, Depends, HTTPException

from backend.models.schemas import ChatRequest, ChatResponse
from backend.utils import auth
from backend.services import chatbotService

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    """Send a message to the health chatbot.

    Returns intelligent, context-aware responses based on user health data.
    Integrates with LLM with fallback models and detailed error reporting.

    Response includes:
    - response: The chatbot's answer
    - (Optional) llm_used, model_used, llm_status in headers for debugging
    """
    try:
        result = await chatbotService.respond(payload.message, userId)
        # Extract response for ChatResponse model
        return {"response": result.get("response", "Unable to generate response")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

