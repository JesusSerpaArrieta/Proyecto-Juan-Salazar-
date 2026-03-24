#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Crear superusuario automáticamente si no existe
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@sisdoc.com', 'SisDoc2024!')
    print('Superusuario creado.')
else:
    print('Superusuario ya existe.')
"
