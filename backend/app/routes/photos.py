from __future__ import annotations

import base64
import binascii
import hashlib
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import ensure_active, is_admin
from app.core.database import get_session
from app.core.identity import require_identity
from app.core.media import media_storage
from app.models import Block, ProfilePhoto, User
from app.routes.users import upsert_local_user

router = APIRouter(prefix="/api", tags=["photos"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 1_800_000
MAX_PHOTOS = 6


class PhotoIn(BaseModel):
    """A client-resized data URL; raw uploads never reach the database."""

    data_url: str = Field(min_length=32, max_length=4_000_000)
    is_public: bool = True


def photo_meta(photo: ProfilePhoto) -> dict:
    return {
        "id": str(photo.id),
        "url": f"/api/photos/{photo.id}",
        "content_type": photo.content_type,
        "byte_size": photo.byte_size,
        "position": photo.position,
        "is_public": photo.is_public,
        "moderation_status": photo.moderation_status,
        "moderation_reason": photo.moderation_reason,
    }


def decode_image(data_url: str) -> tuple[str, bytes]:
    try:
        header, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise HTTPException(422, "이미지 형식을 확인해주세요") from exc
    if not header.startswith("data:") or ";base64" not in header:
        raise HTTPException(422, "이미지 형식을 확인해주세요")
    content_type = header[5:].split(";", 1)[0].lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "JPG, PNG, WEBP 이미지만 올릴 수 있어요")
    try:
        content = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(422, "이미지 데이터를 읽지 못했어요") from exc
    if len(content) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "사진은 1.8MB 이하로 올려주세요")
    if content_type == "image/jpeg" and not content.startswith(b"\xff\xd8\xff"):
        raise HTTPException(422, "JPEG 이미지가 아니에요")
    if content_type == "image/png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(422, "PNG 이미지가 아니에요")
    if content_type == "image/webp" and not (
        content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    ):
        raise HTTPException(422, "WEBP 이미지가 아니에요")
    return content_type, content


async def local_user(session: AsyncSession, coders_id: UUID) -> User:
    user = await upsert_local_user(session, coders_id)
    ensure_active(user)
    return user


@router.get("/profile/photos")
async def list_my_photos(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await local_user(session, coders_id)
    photos = (
        (
            await session.execute(
                select(ProfilePhoto)
                .where(ProfilePhoto.owner_id == user.id)
                .order_by(ProfilePhoto.position, ProfilePhoto.created_at)
            )
        )
        .scalars()
        .all()
    )
    return {"items": [photo_meta(photo) for photo in photos], "limit": MAX_PHOTOS}


@router.post("/profile/photos", status_code=201)
async def add_photo(
    body: PhotoIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await local_user(session, coders_id)
    count = await session.scalar(
        select(func.count(ProfilePhoto.id)).where(ProfilePhoto.owner_id == user.id)
    )
    if (count or 0) >= MAX_PHOTOS:
        raise HTTPException(409, "사진은 최대 6장까지 올릴 수 있어요")
    content_type, content = decode_image(body.data_url)
    digest = hashlib.sha256(content).hexdigest()
    duplicate = await session.scalar(
        select(
            exists().where(
                ProfilePhoto.owner_id == user.id,
                ProfilePhoto.sha256 == digest,
            )
        )
    )
    if duplicate:
        raise HTTPException(409, "이미 등록한 사진이에요")
    photo_id = uuid4()
    extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }[content_type]
    storage_key = None
    database_content: bytes | None = content
    if media_storage.configured:
        storage_key = f"profile/{user.id}/{photo_id}.{extension}"
        try:
            await media_storage.put(storage_key, content, content_type)
        except Exception as exc:
            raise HTTPException(503, "사진 저장소에 잠시 연결할 수 없어요") from exc
        database_content = None
    photo = ProfilePhoto(
        id=photo_id,
        owner_id=user.id,
        content_type=content_type,
        content=database_content,
        storage_key=storage_key,
        byte_size=len(content),
        position=int(count or 0),
        is_public=body.is_public,
        sha256=digest,
        moderation_status="pending",
    )
    session.add(photo)
    await session.flush()
    return {"photo": photo_meta(photo)}


@router.post("/profile/photos/{photo_id}/primary")
async def make_primary(
    photo_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await local_user(session, coders_id)
    target = await session.scalar(
        select(ProfilePhoto).where(
            ProfilePhoto.id == photo_id, ProfilePhoto.owner_id == user.id
        )
    )
    if target is None:
        raise HTTPException(404, "사진을 찾지 못했어요")
    photos = (
        (
            await session.execute(
                select(ProfilePhoto)
                .where(ProfilePhoto.owner_id == user.id)
                .order_by(ProfilePhoto.position, ProfilePhoto.created_at)
            )
        )
        .scalars()
        .all()
    )
    target.position = 0
    next_position = 1
    for photo in photos:
        if photo.id != target.id:
            photo.position = next_position
            next_position += 1
    return {"photo": photo_meta(target)}


@router.delete("/profile/photos/{photo_id}")
async def delete_photo(
    photo_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await local_user(session, coders_id)
    photo = await session.scalar(
        select(ProfilePhoto).where(
            ProfilePhoto.id == photo_id, ProfilePhoto.owner_id == user.id
        )
    )
    if photo is None:
        raise HTTPException(404, "사진을 찾지 못했어요")
    remaining = (
        (
            await session.execute(
                select(ProfilePhoto)
                .where(
                    ProfilePhoto.owner_id == user.id,
                    ProfilePhoto.id != photo.id,
                )
                .order_by(ProfilePhoto.position, ProfilePhoto.created_at)
            )
        )
        .scalars()
        .all()
    )
    storage_key = photo.storage_key
    await session.delete(photo)
    for position, item in enumerate(remaining):
        item.position = position
    if storage_key:
        await media_storage.delete(storage_key)
    return {"status": "ok"}


@router.get("/photos/{photo_id}")
async def serve_photo(
    photo_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> Response:
    viewer = await local_user(session, coders_id)
    photo = await session.get(ProfilePhoto, photo_id)
    if photo is None:
        raise HTTPException(404, "사진을 찾지 못했어요")
    if photo.owner_id != viewer.id:
        blocked = await session.scalar(
            select(
                exists().where(
                    or_(
                        (Block.blocker_id == viewer.id)
                        & (Block.blocked_id == photo.owner_id),
                        (Block.blocker_id == photo.owner_id)
                        & (Block.blocked_id == viewer.id),
                    )
                )
            )
        )
        if (
            blocked
            or not photo.is_public
            or (photo.moderation_status != "approved" and not is_admin(coders_id))
        ):
            raise HTTPException(404, "사진을 찾지 못했어요")
    content = photo.content
    if photo.storage_key:
        try:
            content = await media_storage.fetch(photo.storage_key, MAX_PHOTO_BYTES)
        except Exception as exc:
            raise HTTPException(503, "사진을 잠시 불러올 수 없어요") from exc
    if content is None:
        raise HTTPException(404, "사진을 찾지 못했어요")
    return Response(
        content=content,
        media_type=photo.content_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": "inline",
            "ETag": f'"{photo.sha256 or photo.id}"',
            "Vary": "Cookie",
        },
    )
