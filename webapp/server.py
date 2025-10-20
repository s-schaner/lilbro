"""Minimal FastAPI + HTMX powered web UI for VolleySense."""
from __future__ import annotations

import base64
import json
import logging
import os
from pathlib import Path
from typing import Iterable, List, Tuple

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

LOGGER = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

SESSION_DIR = Path(os.getenv("VOLLEYSENSE_SESSION_DIR", BASE_DIR / "sessions"))
SESSION_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="VolleySense Web UI")


def extract_frames(video_path: str | Path, fps: float, max_frames: int) -> Tuple[List[bytes], dict]:
    """Stub frame extractor returning metadata.

    Real frame extraction would decode the uploaded video at the requested FPS and
    return JPEG bytes for each frame. For now we provide a placeholder so the UI
    remains functional even without heavy multimedia dependencies.
    """

    frame_bytes: List[bytes] = []
    meta = {"src_fps": fps, "duration": 0.0, "frame_count": len(frame_bytes)}
    return frame_bytes, meta


def b64_image_data_uri(payload: bytes, mime: str = "image/jpeg") -> str:
    """Return a data URI for the supplied bytes."""

    encoded = base64.b64encode(payload).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def call_endpoint_openai_chat(
    endpoint: str,
    token: str | None,
    model: str,
    messages: Iterable[dict],
    fps: int,
    max_pixels: int,
    max_tokens: int,
    temperature: float,
) -> dict:
    """Placeholder chat completion call.

    The real implementation would POST to the supplied inference endpoint. Until
    that wiring is complete we simulate a friendly assistant response.
    """

    summary = {
        "rally_state": "pending",
        "who_won": None,
        "reason": "Stubbed response – connect real endpoint to populate",
        "timeline": [],
    }
    content = json.dumps(summary, indent=2)
    return {
        "endpoint": endpoint,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
            }
        ],
        "usage": {
            "fps": fps,
            "max_pixels": max_pixels,
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
    }


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    """Render the analyze console."""

    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/_partial/heatmap", response_class=HTMLResponse)
async def partial_heatmap(_: Request) -> HTMLResponse:
    """Return placeholder heatmap content for HTMX swaps."""

    return HTMLResponse(
        """
        <div class=\"card bg-base-100 shadow\"><div class=\"card-body\">
            <h2 class=\"card-title\">Heatmap</h2>
            <p class=\"opacity-70\">Heatmap tooling is on the roadmap.</p>
        </div></div>
        """
    )


@app.get("/_partial/sessions", response_class=HTMLResponse)
async def partial_sessions(_: Request) -> HTMLResponse:
    """Return placeholder sessions card."""

    return HTMLResponse(
        """
        <div class=\"card bg-base-100 shadow\"><div class=\"card-body\">
            <h2 class=\"card-title\">Sessions</h2>
            <p>Coming soon.</p>
        </div></div>
        """
    )


@app.post("/_api/analyze", response_class=HTMLResponse)
async def analyze_htmx(
    request: Request,
    video: UploadFile = File(...),
    prompt: str = Form(...),
    endpoint: str = Form(...),
    token: str = Form(""),
    model: str = Form("Qwen/Qwen2.5-VL-32B-Instruct"),
    fps: int = Form(3),
    max_frames: int = Form(48),
    max_pixels: int = Form(1048576),
    max_tokens: int = Form(256),
    temperature: float = Form(0.2),
) -> HTMLResponse:
    """Handle the analyze form submission via HTMX."""

    safe_name = Path(video.filename or "upload.bin").name
    tmp_path = SESSION_DIR / f"upload_{safe_name}"
    data = await video.read()
    tmp_path.write_bytes(data)

    try:
        frames, meta = extract_frames(tmp_path, float(fps), int(max_frames))
        imgs = [b64_image_data_uri(frame) for frame in frames]
        message_content: List[dict] = [{"type": "text", "text": prompt}]
        message_content.extend(
            {"type": "image_url", "image_url": {"url": uri}} for uri in imgs
        )
        messages = [{"role": "user", "content": message_content}]
        response_payload = call_endpoint_openai_chat(
            endpoint,
            token or None,
            model,
            messages,
            int(fps),
            int(max_pixels),
            int(max_tokens),
            float(temperature),
        )
        raw = json.dumps(response_payload, indent=2)
        choice = (
            (response_payload.get("choices") or [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        pretty = choice or "(No content)"
        return templates.TemplateResponse(
            "_result_panel.html",
            {"request": request, "pretty": pretty, "raw": raw, "meta": meta},
        )
    except Exception as exc:  # pylint: disable=broad-except
        LOGGER.exception("HTMX analyze failed")
        return HTMLResponse(
            f"<div class='p-4 text-error'>Error: {exc}</div>", status_code=500
        )
