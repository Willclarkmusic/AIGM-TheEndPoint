"""Main FastAPI application for AI Service."""

import os
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import get_settings
from models import HealthResponse, ErrorResponse
from api import chat_router, generate_router
from api.users import router as users_router
from middleware.auth import AuthMiddleware
from middleware.rate_limit import RateLimitMiddleware, limiter
from services.secret_manager import get_secret_manager
from services.firestore_service import get_firestore_service
from services.gemini_service import get_gemini_service
from services.stability_service import get_stability_service

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info("Starting AI Service...")
    settings = get_settings()
    
    # Initialize services
    try:
        # Load API keys
        secret_manager = get_secret_manager()
        api_keys = secret_manager.get_api_keys()
        
        if not all(api_keys.values()):
            logger.warning("Some API keys are missing")
        
        # Initialize Firestore
        firestore = get_firestore_service()
        
        # Initialize AI services
        gemini = get_gemini_service()
        stability = get_stability_service()
        
        logger.info(f"AI Service started successfully in {settings.environment} mode")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Service...")


# Create FastAPI app
app = FastAPI(
    title="AI & GenAI Backend Service",
    description="Central hub for all AI and generative AI functionality",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Get settings
settings = get_settings()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Add custom middleware
# TODO: Fix middleware implementation for production
# app.add_middleware(AuthMiddleware)
# app.add_middleware(RateLimitMiddleware)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include routers
app.include_router(chat_router)
app.include_router(generate_router)
app.include_router(users_router)


@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint."""
    return {
        "service": "AI & GenAI Backend Service",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["health"]
)
async def health_check():
    """Health check endpoint."""
    try:
        # Check service connectivity
        firestore = get_firestore_service()
        secret_manager = get_secret_manager()
        
        # Simple connectivity checks
        services_status = {
            "firestore": firestore.db is not None,
            "secret_manager": True,  # Already initialized if we're running
            "gemini": True,  # Lazy loaded
            "stability": True,  # Lazy loaded
        }
        
        return HealthResponse(
            status="healthy",
            version=settings.app_version,
            services=services_status
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            version=settings.app_version,
            services={
                "firestore": False,
                "secret_manager": False,
                "gemini": False,
                "stability": False,
            }
        )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors."""
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "detail": f"Path {request.url.path} not found",
            "code": "NOT_FOUND"
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected error occurred",
            "code": "INTERNAL_ERROR"
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    # Run with uvicorn for development
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )