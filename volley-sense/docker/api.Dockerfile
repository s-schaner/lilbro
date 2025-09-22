FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/api/pyproject.toml ./
RUN pip install --no-cache-dir "fastapi>=0.104" "uvicorn[standard]>=0.23" "pydantic<2.0"
COPY apps/api ./
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
