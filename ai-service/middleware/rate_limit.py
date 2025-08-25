"""Rate limiting middleware for AI Service."""

from typing import Dict, Optional, Callable
from datetime import datetime, timedelta
from collections import defaultdict, deque
import time
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from services.firestore_service import get_firestore_service
from config import get_settings

logger = structlog.get_logger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Custom rate limiting middleware with per-user tracking."""
    
    def __init__(self, app):
        """Initialize rate limiter."""
        super().__init__(app)
        self.settings = get_settings()
        # In-memory cache for rate limit tracking (for MVP)
        self.user_requests: Dict[str, deque] = defaultdict(deque)
        
    async def dispatch(self, request: Request, call_next):
        """Process request through rate limiter."""
        # Skip rate limiting for health checks and docs
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Extract user ID from request
        user_id = await self._extract_user_id(request)
        if not user_id:
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "detail": "User ID required"}
            )
        
        # Check rate limit for chat endpoints
        if "/chat-call" in request.url.path:
            allowed, remaining = await self._check_rate_limit(user_id)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Rate limit exceeded",
                        "detail": f"Maximum {self.settings.rate_limit_per_minute} requests per minute",
                        "retry_after": 60
                    }
                )
            
            # Add rate limit headers
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(self.settings.rate_limit_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)
            return response
        
        # No rate limiting for other endpoints
        return await call_next(request)
    
    async def _extract_user_id(self, request: Request) -> Optional[str]:
        """Extract user ID from request."""
        try:
            # Try to get from header first
            user_id = request.headers.get("X-User-ID")
            if user_id:
                return user_id
            
            # Try to get from request body (for POST requests)
            if request.method == "POST":
                # Clone request body
                body = await request.body()
                request._body = body  # Reset body for downstream processing
                
                if body:
                    import json
                    try:
                        data = json.loads(body)
                        return data.get("user_id")
                    except json.JSONDecodeError:
                        pass
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting user ID: {e}")
            return None
    
    async def _check_rate_limit(self, user_id: str) -> tuple[bool, int]:
        """
        Check if user is within rate limit.
        
        Args:
            user_id: User to check
            
        Returns:
            Tuple of (allowed, remaining_requests)
        """
        current_time = time.time()
        window_start = current_time - 60  # 1 minute window
        
        # Clean old requests from deque
        user_queue = self.user_requests[user_id]
        while user_queue and user_queue[0] < window_start:
            user_queue.popleft()
        
        # Check limit
        request_count = len(user_queue)
        if request_count >= self.settings.rate_limit_per_minute:
            logger.warning(f"Rate limit exceeded for user {user_id}")
            return False, 0
        
        # Add current request
        user_queue.append(current_time)
        remaining = self.settings.rate_limit_per_minute - len(user_queue)
        
        return True, remaining


# Create a SlowAPI limiter for additional protection
limiter = Limiter(key_func=get_remote_address)


def rate_limit_check(requests_per_minute: int = 5):
    """
    Decorator for rate limiting specific endpoints.
    
    Args:
        requests_per_minute: Number of allowed requests per minute
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        return limiter.limit(f"{requests_per_minute}/minute")(func)
    
    return decorator


async def handle_rate_limit_exceeded(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded errors."""
    response = JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "detail": str(exc),
            "retry_after": 60
        }
    )
    response.headers["Retry-After"] = "60"
    return response