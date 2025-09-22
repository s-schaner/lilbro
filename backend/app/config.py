"""Application configuration and feature flag management."""
from __future__ import annotations

from functools import lru_cache
from typing import Dict

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
