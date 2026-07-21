import json
from typing import Any

import httpx

from app.catalog import CATALOG
from app.config import Settings
from app.schemas import ChatRequest, ChatResponse, WidgetAction, WidgetSpec


SYSTEM_PROMPT = """Eres Ixtla Insights para el dominio requerimientos.
Devuelve exclusivamente JSON valido que coincida con el esquema solicitado.
No inventes datos, no generes SQL y no uses dimensiones o metricas fuera del catalogo.
Cuando el usuario pida una visualizacion, devuelve una sola accion widget_preview.
Si no pide una visualizacion, actions debe ser una lista vacia."""


def is_visual_request(question: str) -> bool:
    normalized = question.lower()
    terms = ("grafica", "gráfica", "pastel", "dona", "barras", "linea", "línea", "tendencia", "tabla", "kpi", "indicador", "promedio semanal", "tiempo de resolución", "tiempo de resolucion")
    return any(term in normalized for term in terms)


def build_widget(question: str) -> WidgetSpec:
    normalized = question.lower()
    kind = "bar"
    dimension = "tramite" if "tramite" in normalized or "trámite" in normalized else "estatus"
    if "pastel" in normalized or "dona" in normalized:
        kind = "donut"
    elif "linea" in normalized or "línea" in normalized or "tendencia" in normalized:
        kind = "line"
        dimension = "fecha"
    elif "tabla" in normalized or "listado" in normalized:
        kind = "table"
    elif "kpi" in normalized or "indicador" in normalized:
        kind = "kpi"
    metric = "total"
    if "tiempo" in normalized and ("resol" in normalized or "cierre" in normalized):
        kind = "kpi"
        metric = "tiempo_resolucion"
    elif "promedio semanal" in normalized:
        kind = "kpi"
        metric = "promedio_semanal"
    elif "cancel" in normalized or "paus" in normalized:
        metric = "pausados_cancelados"
    elif "cerrad" in normalized:
        metric = "cerrados"
    elif "finaliz" in normalized:
        metric = "finalizados"
    elif "abiert" in normalized:
        metric = "abiertos"
    if metric == "pausados_cancelados" and kind != "kpi" and dimension == "estatus":
        dimension = "tramite"
    title = "Tendencia diaria de requerimientos" if kind == "line" else f"Requerimientos por {dimension}"
    if metric == "tiempo_resolucion":
        title = "Tiempo promedio de resolución"
    elif metric == "promedio_semanal":
        title = "Promedio semanal de requerimientos"
    if metric == "finalizados" and kind != "line":
        title = f"Finalizados por {dimension}"
    return WidgetSpec(
        kind=kind,
        title=title,
        metric=metric,
        dimension=dimension,
        period="all",
        filters=[],
        sort="chronological" if dimension == "fecha" else "desc",
        limit=10,
        scope_label="Vista autorizada actual",
    )


def heuristic_response(request: ChatRequest) -> ChatResponse:
    actions: list[WidgetAction] = []
    if is_visual_request(request.question):
        actions.append(WidgetAction(type="widget_preview", widget=build_widget(request.question)))
        answer = "Prepare una vista previa segura para el dashboard actual."
    else:
        answer = "Puedo resumir requerimientos o preparar una visualizacion autorizada por estatus, tramite o fecha."
    return ChatResponse(
        mode="heuristic",
        answer=answer,
        suggestions=CATALOG["suggestions"][:3],
        actions=actions,
    )


def strict_response_schema() -> dict[str, Any]:
    schema = ChatResponse.model_json_schema()

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object":
                node["additionalProperties"] = False
                node["required"] = list(node.get("properties", {}).keys())
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(schema)
    return schema


def output_text(response: dict[str, Any]) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return str(content.get("text", ""))
    return ""


async def openai_response(request: ChatRequest, settings: Settings) -> ChatResponse:
    payload = {
        "model": settings.openai_model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
            {"role": "user", "content": [{"type": "input_text", "text": json.dumps({"request": request.model_dump(), "catalog": CATALOG}, ensure_ascii=False)}]},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "ixtla_insights_chat_response",
                "strict": True,
                "schema": strict_response_schema(),
            }
        },
    }
    headers = {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(settings.openai_api_url, headers=headers, json=payload)
        response.raise_for_status()
    parsed = ChatResponse.model_validate_json(output_text(response.json()))
    return parsed.model_copy(update={"mode": "openai"})
