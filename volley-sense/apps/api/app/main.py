from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analyze, events, exports, explain, stats, trainer

app = FastAPI(title="VolleySense API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(analyze.router)
app.include_router(events.router)
app.include_router(stats.router)
app.include_router(trainer.router)
app.include_router(explain.router)
app.include_router(exports.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok"}
