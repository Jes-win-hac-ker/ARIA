"""
Django settings for the ARIA project (backend/ARIA).

Follows AGENTS.md: no hardcoded secrets; every environment-specific value
comes from environment variables (docker-compose injects them).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# .env is optional (compose injects env vars directly); load it for local runs.
load_dotenv(BASE_DIR / '.env')


def env(key, default=None):
    return os.environ.get(key, default)


SECRET_KEY = env('DJANGO_SECRET_KEY', 'dev-only-insecure-key-change-me')
DEBUG = env('DJANGO_DEBUG', '0') == '1'

ALLOWED_HOSTS = [h.strip() for h in env('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',') if h.strip()]

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
DB_ENGINE = env('DJANGO_DB_ENGINE', 'mysql')
if DB_ENGINE == 'sqlite':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / env('DJANGO_DB_NAME', 'aria.sqlite3'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': env('MYSQL_DATABASE', 'aria'),
            'USER': env('MYSQL_USER', 'aria'),
            'PASSWORD': env('MYSQL_PASSWORD', ''),
            'HOST': env('MYSQL_HOST', 'db'),
            'PORT': env('MYSQL_PORT', '3306'),
            'CONN_MAX_AGE': 60,
            'OPTIONS': {
                'charset': 'utf8mb4',
            },
            'TEST': {
                # Docker MySQL init script creates this user with full rights
                # on test_% databases, so manage.py test needs no extra grants.
                'NAME': 'test_' + env('MYSQL_DATABASE', 'aria'),
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
    o.strip() for o in env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',') if o.strip()
]

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PAGINATION_CLASS': None,
    'UNAUTHENTICATED_USER': None,
}
