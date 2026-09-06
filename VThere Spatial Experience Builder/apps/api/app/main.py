from fastapi import FastAPI

app = FastAPI(title="VThere Spatial Experience Builder API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vthere-api"}