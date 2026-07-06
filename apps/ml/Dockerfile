# v3 ml sidecar image — the only Python in v3 (decision D2). Unlike the Node
# images, its build context is just this app: no workspace files needed.
# Build context: apps/ml
FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir .

# Point the Hugging Face cache at the mount path of the hf-cache named volume
# (see docker-compose.yml) so model downloads survive container rebuilds:
# first start pays the download once, warm starts load from cache (SC-001).
ENV HF_HOME=/hf-cache

EXPOSE 4402
# No model baked into the image — ML_EMBEDDING_MODEL (env, Principle VII)
# decides what loads at runtime, in a background task behind /ready.
CMD ["uvicorn", "ml.main:app", "--host", "0.0.0.0", "--port", "4402"]
