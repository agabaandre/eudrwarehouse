import os

SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "maaif-eudr-superset-secret-change-me")
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SUPERSET_DATABASE_URI", "sqlite:////app/superset_home/superset.db"
)

# Allow embedding and public dashboards when enabled
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
