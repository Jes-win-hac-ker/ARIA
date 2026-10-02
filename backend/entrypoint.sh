#!/bin/sh
set -e

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Start the Gunicorn server
echo "Starting Gunicorn..."
PORT="${PORT:-8000}"
exec gunicorn ARIA.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --threads 2
