from __future__ import annotations

from functools import lru_cache
from typing import List, Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://ccops:ccops_pass@localhost:5432/ccops"
    TEST_DATABASE_URL: str = "postgresql+asyncpg://ccops:ccops_pass@localhost:5432/ccops_test"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── RabbitMQ ──────────────────────────────────────────────────────────────
    RABBITMQ_URL: str = "amqp://ccops:ccops_pass@localhost:5672/"

    # ── Google OAuth ──────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost/api/auth/google/callback"

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Domain Whitelist ──────────────────────────────────────────────────────
    # Declared as str so pydantic-settings never tries to JSON-decode it.
    # Accepts either ALLOWED_EMAIL_DOMAINS or ALLOWED_EMAIL_DOMAINS_STR from env.
    allowed_domains_raw: str = Field(
        default="college.edu",
        validation_alias=AliasChoices("ALLOWED_EMAIL_DOMAINS", "ALLOWED_EMAIL_DOMAINS_STR"),
    )

    @property
    def ALLOWED_EMAIL_DOMAINS(self) -> List[str]:
        return [d.strip() for d in self.allowed_domains_raw.split(",") if d.strip()]

    # ── App ───────────────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True

    # Accepts either CORS_ORIGINS or CORS_ORIGINS_STR from env.
    cors_origins_raw: str = Field(
        default="http://localhost,http://localhost:3000",
        validation_alias=AliasChoices("CORS_ORIGINS", "CORS_ORIGINS_STR"),
    )

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]

    # ── File Storage ──────────────────────────────────────────────────────────
    FILE_STORAGE_BACKEND: Literal["local", "s3"] = "local"
    LOCAL_STORAGE_PATH: str = "/app/media"

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET_NAME: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
