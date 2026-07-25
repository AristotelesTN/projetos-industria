# Nao on Render — image oficial + projeto plataforma (DuckDB).
# Build context = raiz do repo.
FROM getnao/nao:latest

USER root
WORKDIR /app/project

COPY nao/ /app/project/

# Garante DuckDB a partir dos CSVs (duckdb pode estar ausente no git)
RUN pip install --no-cache-dir duckdb==1.2.2 \
  && python scripts/build_duckdb.py \
  && chown -R nao:nao /app/project || true

ENV NAO_CONTEXT_SOURCE=local \
    NAO_DEFAULT_PROJECT_PATH=/app/project \
    SERVER_PORT=10000

COPY docker/nao/render-entrypoint.sh /render-entrypoint.sh
RUN chmod +x /render-entrypoint.sh

EXPOSE 10000
ENTRYPOINT ["/render-entrypoint.sh"]
