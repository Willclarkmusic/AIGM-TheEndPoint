"""Authentication middleware for AI Service."""

from typing import Optional, Callable
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt
import structlog
from services.firestore_service import get_firestore_service
from config import get_settings

logger = structlog.get_logger(__name__)

# Security scheme
security = HTTPBearer(auto_error=False)


class AuthMiddleware(BaseHTTPMiddleware):
    """Authentication middleware for validating requests."""
    
    async def dispatch(self, request: Request, call_next):
        """Process request through auth middleware."""
        # Skip auth for health checks and docs
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc", "/"]:
            return await call_next(request)
        
        # For MVP, we're using simple header-based auth
        # In production, this should validate Firebase Auth tokens
        user_id = request.headers.get("X-User-ID")
        api_key = request.headers.get("X-API-Key")
        
        # Validate request has required auth
        if not user_id:
            return JSONResponse(
                status_code=401,
                content={
                    "error": "Unauthorized",
                    "detail": "User ID required in X-User-ID header"
                }
            )
        
        # For internal service-to-service calls, validate API key
        if api_key:
            settings = get_settings()
            # For MVP, simple validation
            if api_key != settings.gemini_api_key:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "Forbidden", 
                        "detail": "Invalid API key"
                    }
                )
        
        # Store user info in request state
        request.state.user_id = user_id
        request.state.authenticated = True
        
        # Continue processing
        return await call_next(request)


async def verify_request(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    Verify request authentication for protected endpoints.
    
    Args:
        credentials: Bearer token from request
        
    Returns:
        User ID if authenticated
        
    Raises:
        HTTPException: If authentication fails
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authorization required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # For MVP, we'll accept the token as user ID
        # In production, this should validate Firebase Auth tokens
        token = credentials.credentials
        
        # Simple validation - in production, decode JWT
        if not token or len(token) < 10:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )
        
        # For MVP, extract user ID from token
        # In production, decode from JWT claims
        user_id = token.split("-")[0] if "-" in token else token
        
        return user_id
        
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )


async def get_current_user(user_id: str = Depends(verify_request)) -> str:
    """
    Get current authenticated user.
    
    Args:
        user_id: User ID from auth
        
    Returns:
        User ID
    """
    return user_id


def require_credits(credit_type: str, amount: int):
    """
    Decorator to require credits for an endpoint.
    
    Args:
        credit_type: Type of credits required ("chat" or "genai")
        amount: Amount of credits required
        
    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            # Get user ID from kwargs
            user_id = kwargs.get("user_id")
            if not user_id:
                raise HTTPException(
                    status_code=401,
                    detail="User ID required"
                )
            
            # Check credits
            firestore = get_firestore_service()
            user_credits = await firestore.get_user_credits(user_id)
            
            if not user_credits:
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )
            
            # Check balance
            current_credits = (
                user_credits.chat_credits if credit_type == "chat" 
                else user_credits.gen_ai_credits
            )
            
            if current_credits < amount:
                raise HTTPException(
                    status_code=402,
                    detail=f"Insufficient {credit_type} credits. Required: {amount}, Available: {current_credits}"
                )
            
            # Call original function
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator