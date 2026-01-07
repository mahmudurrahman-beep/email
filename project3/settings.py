"""
Django settings for project3.

This settings file is production-ready and reads secrets and environment-specific
values from environment variables. It also keeps compatibility for local
development by falling back to sensible defaults (SQLite) when env vars are not set.

Environment variables expected in production:
- SECRET_KEY
- DEBUG ("true"/"false")
- DATABASE_URL (e.g. postgresql://user:pass@host:port/dbname)
- ALLOWED_HOSTS (comma-separated)
"""

import os
from pathlib import Path
import dj_database_url

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY
SECRET_KEY = os.environ.get("SECRET_KEY", "unsafe-default-secret-change-me")
DEBUG = os.environ.get("DEBUG", "false").lower() in ("1", "true", "yes")

# ALLOWED_HOSTS: comma-separated list in env, fallback to empty list
_allowed = os.environ.get("ALLOWED_HOSTS", "")
if _allowed:
    ALLOWED_HOSTS = [h.strip() for h in _allowed.split(",") if h.strip()]
else:
    ALLOWED_HOSTS = ["*"] if DEBUG else []

# Application definition
INSTALLED_APPS = [
    "mail",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise for static files
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "project3.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "project3.wsgi.application"

# Database
# Use DATABASE_URL env var (dj-database-url). Fallback to sqlite for local dev.
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
)

# Parse database config with dj_database_url
# ssl_require is set to True when not in DEBUG to prefer TLS connections
DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=not DEBUG)
}

# Custom user model
AUTH_USER_MODEL = "mail.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "UTC")
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Static files (served by WhiteNoise)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media (optional)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Security settings
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG

if not DEBUG:
    SECURE_HSTS_SECONDS = 60  # increase to 31536000 after testing
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
else:
    SECURE_HSTS_SECONDS = 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False

# Logging - console output for platform logs
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "%(levelname)s %(asctime)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Email backend (console by default; override via EMAIL_BACKEND env var)
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")

# Admins (optional)
ADMINS = tuple(
    (a.strip(), a.strip()) for a in os.environ.get("ADMINS", "").split(",") if a.strip()
)

# Session settings
SESSION_COOKIE_AGE = int(os.environ.get("SESSION_COOKIE_AGE", 1209600))  # 2 weeks default

# Optional: print a small startup message in logs (useful for debugging)
if DEBUG:
    import logging
    logging.getLogger().info("Running in DEBUG mode. ALLOWED_HOSTS=%s", ALLOWED_HOSTS)
