"""
Django settings for the ARIA project (backend/ARIA).

Follows AGENTS.md: no hardcoded secrets; every environment-specific value
comes from environment variables (docker-compose injects them).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR.parent / '.env')


def env(key, default=None):
    return os.environ.get(key, default)


SECRET_KEY = env('DJANGO_SECRET_KEY', 'dev-only-insecure-key-change-me')
DEBUG = env('DJANGO_DEBUG', '0') == '1'

ALLOWED_HOSTS = [h.strip() for h in env('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',') if h.strip()]
if 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'api',
    'evals',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'ARIA.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'ARIA.wsgi.application'

# --- Database: MySQL 8 driven entirely by env vars (AGENTS.md section 6/12) ---
# In Docker, MYSQL_HOST="db" is injected so it connects to MySQL container.
# In local host development without MySQL env vars, fallback cleanly to sqlite.
_default_engine = 'mysql' if (env('MYSQL_HOST') or env('DB_HOST')) else 'sqlite'
DB_ENGINE = env('DJANGO_DB_ENGINE', _default_engine)

if DB_ENGINE == 'sqlite':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / env('DJANGO_DB_NAME', 'aria.sqlite3'),
            'OPTIONS': {
                'timeout': 30,  # Prevent OperationalError: database is locked under concurrency
            },
        }
    }
else:
    try:
        import MySQLdb  # noqa
    except ImportError:
        try:
            import pymysql
            pymysql.install_as_MySQLdb()
        except ImportError:
            pass

    db_name = env('MYSQL_DATABASE') or env('DB_NAME') or 'stock'
    db_user = env('MYSQL_USER') or env('DB_USER') or 'stock_analyst'
    db_password = env('MYSQL_PASSWORD') or env('DB_PASSWORD') or 'stockpass'
    db_host = env('MYSQL_HOST') or env('DB_HOST') or 'db'
    db_port = env('MYSQL_PORT') or env('DB_PORT') or '3306'

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': db_name,
            'USER': db_user,
            'PASSWORD': db_password,
            'HOST': db_host,
            'PORT': db_port,
            'CONN_MAX_AGE': 60,
            'OPTIONS': {
                'charset': 'utf8mb4',
            },
            'TEST': {
                # Docker MySQL init script creates this user with full rights
                # on test_% databases, so manage.py test needs no extra grants.
                'NAME': 'test_' + db_name,
            },
        }
    }

LANGUAGE_CODE = 'en-us'
TIME_ZONE = env('TZ', 'Asia/Kolkata')
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- CORS: frontends (if any) configured via env, comma-separated origins ---
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001').split(',') if o.strip()
]

# --- Cache: In-memory cache for fast, microsecond-overhead rate limiting without external dependencies ---
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'aria-default-cache',
    }
}

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PAGINATION_CLASS': None,
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
    },
}
