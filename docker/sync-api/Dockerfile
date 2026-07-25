FROM python:3.12-slim

RUN pip install --no-cache-dir duckdb==1.2.2

WORKDIR /app
COPY app.py /app/app.py

ENV PORT=8787 \
    NAO_PROJECT_PATH=/nao \
    RESTART_NAO=false

EXPOSE 8787
CMD ["python", "-u", "/app/app.py"]
