#!/bin/bash
# Grants the app user rights on Django's test databases (test_%), so
# `manage.py test` works inside the container without extra setup.
# Runs once on first container init; MYSQL_* env vars are provided by compose.
# NOTE: do NOT create test databases here — Django's test runner creates them
# itself and only needs the grants (pattern grants don't require existence).
set -euo pipefail

mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<SQL
GRANT ALL PRIVILEGES ON \`test_%\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL

echo "test grants applied for ${MYSQL_USER}"
