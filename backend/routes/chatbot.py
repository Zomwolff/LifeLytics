"""AI chatbot routes."""
from fastapi import APIRouter, Depends, HTTPException
from backend.models.schemas import ChatRequest, ChatResponse
from backend.utils import auth
from backend.utils import firestore_db
from backend.services import chatbotService

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    userId: str = Depends(auth.getCurrentUserDependency),
):
    try:
        result = await chatbotService.respond(payload.message, userId)
        return {"response": result.get("response", "Unable to generate response")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def getChatHistory(userId: str = Depends(auth.getCurrentUserDependency)):
    """Get persistent chat history for the user."""
    try:
        history = await firestore_db.getChatHistory(userId, limit=50)
        return {"history": history, "count": len(history)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history")
async def clearChatHistory(userId: str = Depends(auth.getCurrentUserDependency)):
    """Clear all chat history for the user."""
    try:
        await firestore_db.clearChatHistory(userId)
        return {"message": "Chat history cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))