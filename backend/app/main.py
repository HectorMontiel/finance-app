"""
FastAPI application entry point.
Security headers, CORS, global error handler, and rate limiting are wired here.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging, get_logger

settings = get_settings()
configure_logging(settings.log_level)
_logger = get_logger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Finance API",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,  # hide Swagger in prod
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    _logger.warning(
        "app_error",
        public_message=exc.public_message,
        internal_detail=exc.internal_detail,
        status_code=exc.status_code,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.public_message},
    )


app.include_router(v1_router)
