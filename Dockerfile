
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && pip install gunicorn eventlet
COPY . .
ENV PORT=10000
CMD ["bash","-lc","gunicorn -k eventlet -w 1 app.server:app --bind 0.0.0.0:$PORT"]
