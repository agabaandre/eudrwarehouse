import os

SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "maaif-eudr-superset-secret-change-me")
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SUPERSET_DATABASE_URI", "sqlite:////app/superset_home/superset.db"
)

PUBLIC_ROLE_LIKE_GAMMA = os.environ.get("SUPERSET_PUBLIC_MODE", "false").lower() == "true"
GUEST_ROLE_NAME = "Public"
GUEST_TOKEN_JWT_SECRET = os.environ.get("SUPERSET_GUEST_TOKEN_SECRET", SECRET_KEY)
GUEST_TOKEN_JWT_ALGO = "HS256"
GUEST_TOKEN_HEADER_NAME = "X-GuestToken"
GUEST_TOKEN_JWT_EXP_SECONDS = 3600

FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_RBAC": True,
    "EMBEDDED_SUPERSET": True,
}

WTF_CSRF_ENABLED = True
TALISMAN_ENABLED = False

# Subpath behind nginx at http://HOST:8003/superset/
# App serves routes at /login/, /welcome/ — nginx strips /superset/ prefix and sets X-Script-Name.
_base = os.environ.get("SUPERSET_WEBSERVER_BASEPATH", "/superset").rstrip("/") or "/superset"
SUPERSET_WEBSERVER_BASEPATH = _base

ENABLE_PROXY_FIX = True
PREFERRED_URL_SCHEME = os.environ.get("PREFERRED_URL_SCHEME", "http")

# Session cookies scoped to /superset so login persists behind the proxy
SESSION_COOKIE_PATH = f"{_base}/"
SESSION_COOKIE_SAMESITE = "Lax"

# Flask ProxyFix — honour X-Forwarded-* from nginx
PROXY_FIX_CONFIG = {
    "x_for": 1,
    "x_proto": 1,
    "x_host": 1,
    "x_port": 1,
    "x_prefix": 1,
}
