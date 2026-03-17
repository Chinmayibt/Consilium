from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    MONGODB_URI: str = Field(..., env="MONGODB_URI")
    MONGODB_DB_NAME: str = Field("projectai", env="MONGODB_DB_NAME")
    JWT_SECRET: str = Field(..., env="JWT_SECRET")
    JWT_REFRESH_SECRET: str = Field(..., env="JWT_REFRESH_SECRET")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GROQ_REQUIREMENTS_API_KEY: str = Field(..., env="GROQ_REQUIREMENTS_API_KEY")
    GROQ_PLANNING_API_KEY: str = Field(..., env="GROQ_PLANNING_API_KEY")
    PLANNING_AGENT_KEY: str | None = Field(default=None, env="PLANNING_AGENT_KEY")
    MONITORING_AGENT_KEY: str | None = Field(default=None, env="MONITORING_AGENT_KEY")
    RISK_AGENT_KEY: str | None = Field(default=None, env="RISK_AGENT_KEY")
    REPLANNING_AGENT_KEY: str | None = Field(default=None, env="REPLANNING_AGENT_KEY")

    # GitHub integration
    GITHUB_CLIENT_ID: str | None = Field(default=None, env="GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET: str | None = Field(default=None, env="GITHUB_CLIENT_SECRET")
    GITHUB_REDIRECT_URI: str | None = Field(
        default=None, env="GITHUB_REDIRECT_URI"
    )  # e.g. http://localhost:8000/api/github/callback
    GITHUB_WEBHOOK_SECRET: str | None = Field(
        default=None, env="GITHUB_WEBHOOK_SECRET"
    )
    # Where the React app runs; used for post-OAuth redirect (not the OAuth redirect_uri)
    FRONTEND_URL: str = Field(
        default="http://localhost:8080",
        env="FRONTEND_URL",
    )

    GEMINI_API_KEY: str | None = Field(default=None, env="GEMINI_API_KEY")

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
