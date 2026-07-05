# Build context: v3/apps/ml
FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir .

ENV HF_HOME=/hf-cache

EXPOSE 4402
CMD ["uvicorn", "ml.main:app", "--host", "0.0.0.0", "--port", "4402"]
