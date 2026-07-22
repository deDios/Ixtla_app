from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Scope(StrictSchema):
    domain: Literal["requerimientos"]
    empleado_id: int | None = None
    cuenta_id: int | None = None


class HistoryMessage(StrictSchema):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=400)


class ChatRequest(StrictSchema):
    question: str = Field(min_length=1, max_length=800)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=6)
    scope: Scope
    dashboard_id: str = Field(default="", max_length=120)


class WidgetSpec(StrictSchema):
    kind: Literal["kpi", "bar", "donut", "line", "area", "table", "funnel"]
    title: str = Field(min_length=3, max_length=100)
    metric: Literal["total", "abiertos", "finalizados", "pausados_cancelados", "pausados", "cancelados", "cerrados", "promedio_semanal", "tiempo_resolucion"]
    dimension: Literal["estatus", "tramite", "departamento", "fecha"]
    period: Literal["all", "last_7", "last_30", "this_month"] = "all"
    scope: Literal["all", "selected"] = "all"
    filters: list[dict[str, str]] = Field(default_factory=list, max_length=3)
    sort: Literal["desc", "asc", "chronological"] = "desc"
    limit: int = Field(default=10, ge=1, le=50)
    scope_label: str = Field(min_length=3, max_length=160)


class WidgetAction(StrictSchema):
    type: Literal["widget_preview"]
    widget: WidgetSpec


class ChatResponse(StrictSchema):
    ok: Literal[True] = True
    mode: Literal["heuristic", "openai"]
    answer: str
    suggestions: list[str] = Field(max_length=5)
    actions: list[WidgetAction] = Field(max_length=1)
