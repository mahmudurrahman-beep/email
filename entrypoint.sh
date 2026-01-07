#!/bin/bash
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput
exec gunicorn project3.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --config gunicorn.conf.py
