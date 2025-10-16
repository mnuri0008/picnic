
# Deploy options
## Render (Python)
Build: pip install -r requirements.txt && pip install gunicorn eventlet
Start: gunicorn -k eventlet -w 1 app.server:app
## Docker
docker build -t nuri-piknik .
docker run -p 8000:10000 -e PORT=10000 nuri-piknik
