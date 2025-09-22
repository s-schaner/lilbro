from __future__ import annotations

from fastapi import APIRouter, Response

from ...services import mock_data

router = APIRouter(prefix="/export", tags=["exports"])


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/summary.pdf")
async def export_summary(game_id: str) -> Response:
    return mock_data.build_pdf(game_id)


@router.get("/players.csv")
async def export_players(game_id: str) -> Response:
    csv_content = mock_data.build_csv(mock_data.generate_players(game_id))
    headers = {"Content-Disposition": "attachment; filename=players.csv"}
    return Response(csv_content, media_type="text/csv", headers=headers)


@router.get("/highlights.zip")
async def export_highlights() -> Response:
    return mock_data.build_highlights_zip()


ROUTERS = (router,)
