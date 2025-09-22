from fastapi import APIRouter, Query
from fastapi.responses import Response

from ..services.mock_data import build_csv, build_highlights_zip, build_pdf, generate_players

router = APIRouter(prefix="/export", tags=["exports"])


@router.get("/summary.pdf")
async def export_summary(game_id: str = Query("demo-1")):
    return build_pdf(game_id)


@router.get("/players.csv")
async def export_players(game_id: str = Query("demo-1")) -> Response:
    content = build_csv(generate_players(game_id))
    headers = {"Content-Disposition": "attachment; filename=players.csv"}
    return Response(content=content, media_type="text/csv", headers=headers)


@router.get("/highlights.zip")
async def export_highlights() -> Response:
    return build_highlights_zip()
