from __future__ import annotations

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import ensure_active
from app.core.config import settings
from app.core.database import get_session
from app.core.identity import require_identity
from app.routes.users import upsert_local_user

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("/search")
async def search_places(
    q: Annotated[str, Query(min_length=2, max_length=60)],
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Proxy a bounded Kakao Local search without exposing the REST key."""
    user = await upsert_local_user(session, coders_id)
    ensure_active(user)
    map_rest_key = settings.kakao_map_rest_key or settings.kakao_client_id
    if not map_rest_key:
        raise HTTPException(503, "장소 검색이 아직 설정되지 않았어요")
    query = " ".join(q.split())
    if len(query) < 2:
        raise HTTPException(422, "두 글자 이상 입력해주세요")
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(
                "https://dapi.kakao.com/v2/local/search/keyword.json",
                params={"query": query, "size": 10, "sort": "accuracy"},
                headers={"Authorization": f"KakaoAK {map_rest_key}"},
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "장소 검색에 잠시 연결할 수 없어요") from exc

    items = []
    for place in payload.get("documents", [])[:10]:
        items.append(
            {
                "id": str(place.get("id", ""))[:32],
                "name": str(place.get("place_name", ""))[:100],
                "category": str(place.get("category_name", ""))[:160],
                "phone": str(place.get("phone", ""))[:32],
                "address": str(
                    place.get("road_address_name") or place.get("address_name") or ""
                )[:160],
                "place_url": str(place.get("place_url", ""))[:500],
                "longitude": float(place["x"]),
                "latitude": float(place["y"]),
            }
        )
    return {"items": items, "query": query}
