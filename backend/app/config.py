"""Application configuration and feature flag management."""
from __future__ import annotations

from functools import lru_cache
from typing import Dict, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration sourced from the environment."""

    project_name: str = "VolleySense API"
    llm_base_url: str = "http://localhost:1234/v1"
    enable_ingest: bool = True
    enable_trainer: bool = True
    enable_screen_snap: bool = True
    enable_insights: bool = True
    enable_exports: bool = True
    allowed_frontend_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    @field_validator("allowed_frontend_origins", mode="before")
    @classmethod
    def _parse_allowed_frontend_origins(cls, value: object) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        if isinstance(value, (list, tuple)):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        if isinstance(value, (set, frozenset)):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        raise TypeError(
            "allowed_frontend_origins must be provided as a list, tuple, set, or comma-separated string"
        )

    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    @property
    def feature_flags(self) -> Dict[str, bool]:
        return {
            "ingest": self.enable_ingest,
            "trainer": self.enable_trainer,
            "screen_snap": self.enable_screen_snap,
            "insights": self.enable_insights,
            "exports": self.enable_exports,
        }


@lru_cache()
def get_settings() -> Settings:
    """Return a cached settings instance."""

    return Settings()
