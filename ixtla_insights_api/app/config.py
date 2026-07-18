from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = SERVICE_ROOT.parent

# El .env propio tiene prioridad. PRI/.env es el origen compartido local del proveedor.
load_dotenv(SERVICE_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "PRI" / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    return value in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    service_token: str
    enable_openai: bool
    openai_api_key: str
    openai_api_url: str
    openai_model: str


def get_settings() -> Settings:
    return Settings(
        service_token=os.getenv("IXTLA_INSIGHTS_SERVICE_TOKEN", "").strip(),
        enable_openai=env_bool("IXTLA_INSIGHTS_ENABLE_OPENAI"),
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        openai_api_url=os.getenv("OPENAI_API_URL", "https://api.openai.com/v1/responses").strip(),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5.4").strip(),
    )
