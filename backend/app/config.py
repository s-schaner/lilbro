"""Application configuration and feature flag management."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Dict, List

from pydantic import Field, field_validator
from pydantic.fields import FieldInfo
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import PydanticBaseSettingsSource


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

    model_config = SettingsConfigDict(
        env_prefix="",
        case_sensitive=False,
    )

    @staticmethod
    def _lenient_decode_complex_value(
        _source: PydanticBaseSettingsSource,
        field_name: str,
        field: FieldInfo,
        value: object,
    ) -> object:
        """Decode complex values while tolerating plain strings.

        The default :mod:`pydantic-settings` behaviour assumes complex values
        are encoded as JSON. Deployments often configure
        ``ALLOWED_FRONTEND_ORIGINS`` as a simple comma separated string (or leave
        it blank). In those cases ``json.loads`` raises ``JSONDecodeError`` and
        prevents the API from starting. We fall back to the original string and
        let the field validator normalise the value.
        """

        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return ""
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                return value
        try:
            return json.loads(value)  # type: ignore[arg-type]
        except (TypeError, json.JSONDecodeError):
            return value

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        env_settings.decode_complex_value = cls._lenient_decode_complex_value.__get__(
            env_settings, env_settings.__class__
        )
        return init_settings, env_settings, dotenv_settings, file_secret_settings

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
