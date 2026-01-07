# gunicorn.conf.py
import multiprocessing

# Worker configuration
workers = 1  # adjust if your plan allows more
worker_class = 'sync'
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Process naming
proc_name = 'email'
