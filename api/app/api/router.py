"""Root API router registration."""

from fastapi import APIRouter

from app.routers.dmrc import router as dmrc_router
from app.routers.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(dmrc_router)
