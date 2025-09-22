from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .modules.manager import ModuleRegistry
from .routers import modules

app = FastAPI(title="VolleySense API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

registry = ModuleRegistry()
modules_dir = Path(__file__).parent / "modules"
config_path = Path(__file__).parent / "modules.json"
registry.load(app, modules_dir, config_path=config_path)
app.state.module_registry = registry

app.include_router(modules.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok"}
