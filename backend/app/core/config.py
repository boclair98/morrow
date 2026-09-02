from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Provided by the coders.kr platform via coders.yaml substitution.
    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/app"
    # Canonical browser origin used for CSRF validation behind reverse proxies.
    # Override this when the service moves to a custom domain.
    public_app_url: str = "https://morrow.coders.kr"

    # Local-dev escape hatch: when set, an X-Coders-User-less request is
    # treated as if it came from this UUID. Lets you `curl` the API
    # without the platform gate in front. Never set in production.
    dev_fake_user: str | None = None

    # `native` trusts the coders.kr identity header. `standalone` ignores that
    # header and authenticates only the app-owned, database-backed session
    # cookie. Production switches to standalone when social OAuth is enabled.
    auth_mode: str = "native"
    session_cookie_name: str = "morrow_session"
    session_days: int = 30

    # Reserved for the next auth migration. Native coders.kr mode remains the
    # active identity boundary until provider credentials and standalone mode
    # are explicitly enabled.
    kakao_client_id: str | None = None
    naver_client_id: str | None = None
    google_client_id: str | None = None
    kakao_client_secret: str | None = None
    kakao_redirect_uri: str | None = None
    naver_client_secret: str | None = None
    naver_redirect_uri: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None
    turnstile_site_key: str | None = None
    turnstile_secret_key: str | None = None
    # Keep map credentials separate from Kakao Login. Kakao only grants the
    # account's free map quota to the first app that enabled Kakao Map, which
    # may be a different app from the one used for social login.
    kakao_map_rest_key: str | None = None
    next_public_kakao_map_js_key: str | None = None
    redis_url: str | None = None
    storage_bucket: str | None = None
    storage_region: str = "auto"
    storage_s3_endpoint: str | None = None
    storage_access_key: str | None = None
    storage_secret_key: str | None = None
    storage_public_url: str | None = None
    apple_client_id: str | None = None
    apple_team_id: str | None = None
    apple_key_id: str | None = None

    # Comma-separated coders.kr UUIDs. Keep production values in the platform
    # secret store; never expose admin access through the frontend alone.
    admin_coders_ids: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
