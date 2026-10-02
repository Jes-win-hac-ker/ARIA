#!/bin/sh
set -e

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Seed corporate fundamentals if not already seeded
echo "Seeding market data and corporate fundamentals..."
python manage.py load_market_data || true

# Start the Gunicorn server
echo "Starting Gunicorn..."
PORT="${PORT:-8000}"
exec gunicorn ARIA.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --threads 2
