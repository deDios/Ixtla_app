import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException

from app.catalog import CATALOG
from app.config import Settings, get_settings
from app.schemas import ChatRequest, ChatResponse
from app.services import heuristic_response, openai_response


app = FastAPI(title="Ixtla Insights API", version="0.1.0")


def settings_dependency() -> Settings:
    return get_settings()


def require_internal_key(
    settings: Annotated[Settings, Depends(settings_dependency)],
    key: Annotated[str | None, Header(alias="X-Ixtla-Insights-Key")] = None,
) -> None:
    if settings.service_token and not secrets.compare_digest(key or "", settings.service_token):
        raise HTTPException(status_code=401, detail="Servicio no autorizado.")


@app.get("/v1/insights/health", dependencies=[Depends(require_internal_key)])
async def health(settings: Annotated[Settings, Depends(settings_dependency)]) -> dict:
    return {
        "ok": True,
        "service": "ixtla-insights-api",
        "mode": "openai" if settings.enable_openai else "heuristic",
        "model": settings.openai_model,
    }


@app.get("/v1/insights/catalog", dependencies=[Depends(require_internal_key)])
async def catalog() -> dict:
    return {"ok": True, "catalog": CATALOG}


@app.post("/v1/insights/chat", response_model=ChatResponse, dependencies=[Depends(require_internal_key)])
async def chat(
    request: ChatRequest,
    settings: Annotated[Settings, Depends(settings_dependency)],
) -> ChatResponse:
    if settings.enable_openai and settings.openai_api_key:
        return await openai_response(request, settings)
    return heuristic_response(request)
