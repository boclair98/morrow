"use client";

import { Camera, Check, Crown, LoaderCircle, LockKeyhole, Star, Trash2 } from "lucide-react";
import NextImage from "next/image";
import { ChangeEvent, useState } from "react";

import {
  deleteProfilePhoto,
  makePrimaryPhoto,
  type ProfilePhoto,
  uploadProfilePhoto,
} from "@/lib/api";

const MAX_PHOTOS = 6;
const MAX_UPLOAD_BYTES = 1_700_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("사진을 읽지 못했어요"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있어요");
  if (file.size > 20_000_000) throw new Error("20MB 이하의 사진만 올릴 수 있어요");
  const source = await readAsDataUrl(file);
  const image = new Image();
  image.src = source;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("이미지를 읽지 못했어요"));
  });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진을 준비하지 못했어요");
  const maxDimension = Math.max(image.naturalWidth, image.naturalHeight);
  const maxEdges = [1440, 1280, 1120, 980, 860];
  const qualities = [0.82, 0.72, 0.64, 0.56, 0.48];
  for (let attempt = 0; attempt < maxEdges.length; attempt += 1) {
    const scale = Math.min(1, maxEdges[attempt] / maxDimension);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const type of ["image/webp", "image/jpeg"] as const) {
      const dataUrl = await canvasDataUrl(canvas, type, qualities[attempt]);
      if (dataUrl && dataUrlByteLength(dataUrl) <= MAX_UPLOAD_BYTES) return dataUrl;
    }
  }
  throw new Error("사진 용량을 충분히 줄이지 못했어요. 다른 사진을 선택해주세요");
}

function canvasDataUrl(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("사진을 읽지 못했어요"));
      reader.readAsDataURL(blob);
    }, type, quality);
  });
}

function dataUrlByteLength(dataUrl: string): number {
  const encoded = dataUrl.split(",", 2)[1] ?? "";
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
}

export function ProfilePhotos({
  initialPhotos,
  onPhotosChange,
}: {
  initialPhotos: ProfilePhoto[];
  onPhotosChange?: (photos: ProfilePhoto[]) => void;
}) {
  const [photos, setPhotos] = useState<ProfilePhoto[]>(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const added: ProfilePhoto[] = [];
      for (const file of files) {
        const dataUrl = await compressImage(file);
        added.push((await uploadProfilePhoto(dataUrl)).photo);
      }
      const next = [...photos, ...added].sort((a, b) => a.position - b.position);
      setPhotos(next);
      onPhotosChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진을 올리지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: ProfilePhoto) {
    if (!window.confirm("이 사진을 프로필에서 삭제할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProfilePhoto(photo.id);
      const next = photos
        .filter((item) => item.id !== photo.id)
        .map((item, index) => ({ ...item, position: index }));
      setPhotos(next);
      onPhotosChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진을 삭제하지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  async function primary(photo: ProfilePhoto) {
    if (photo.position === 0) return;
    setBusy(true);
    setError(null);
    try {
      await makePrimaryPhoto(photo.id);
      const next = [photo, ...photos.filter((item) => item.id !== photo.id)].map(
        (item, index) => ({ ...item, position: index }),
      );
      setPhotos(next);
      onPhotosChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "대표 사진을 바꾸지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-busy={busy} className="morrow-card-lift mt-6 rounded-[26px] border border-[#e9e1dd] bg-white/90 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-black text-[#ff5d68]"><Camera className="size-4" />PROFILE PHOTOS</p>
          <h2 className="mt-2 text-xl font-black">사진으로 분위기를 먼저 보여주세요</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#847872]">승인된 사진만 MORROW 멤버에게 공개돼요. 얼굴과 분위기가 잘 보이는 최근 사진으로 프로필을 완성해 주세요.</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-[#fff4f1] px-3 py-2 text-right">
          <p className="text-[10px] font-black text-[#c65b62]">등록 사진</p>
          <p className="mt-0.5 text-lg font-black text-[#ff5d68]">{photos.length}/{MAX_PHOTOS}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((photo, index) => (
          <div key={photo.id} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#f7f1ee]">
            <NextImage src={photo.url} alt={`프로필 사진 ${index + 1}`} fill unoptimized sizes="(max-width: 640px) 33vw, 140px" className="object-cover" />
            {photo.position === 0 && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-[#bd5c61]"><Crown className="mr-1 inline size-3" />대표</span>}
            {photo.moderation_status === "pending" && <span className="absolute right-1.5 top-1.5 rounded bg-black/65 px-1.5 py-1 text-[9px] font-black text-white">검수 중</span>}
            {photo.moderation_status === "rejected" && <span className="absolute inset-x-1.5 top-1.5 rounded bg-red-600 px-1.5 py-1 text-center text-[9px] font-black text-white">공개 중단</span>}
            <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              {photo.position !== 0 && <button type="button" onClick={() => primary(photo)} className="grid size-8 place-items-center rounded-xl bg-black/65 text-white" aria-label="대표 사진으로 설정"><Star className="size-3.5" /></button>}
              <button type="button" onClick={() => remove(photo)} className="grid size-8 place-items-center rounded-xl bg-black/65 text-white" aria-label="사진 삭제"><Trash2 className="size-3.5" /></button>
            </div>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfd3ce] bg-[#fcfaf9] text-center transition hover:border-[#ff9da4] hover:bg-[#fff7f5]">
          {busy ? <LoaderCircle className="size-6 animate-spin text-[#ff5d68]" /> : <><span className="grid size-10 place-items-center rounded-full bg-[#fff0ed] text-[#ff5d68]"><Camera className="size-5" /></span><span className="mt-2 text-[11px] font-black text-[#7f736d]">사진 추가</span><span className="mt-0.5 text-[10px] font-semibold text-[#b0a29b]">{photos.length}/{MAX_PHOTOS}</span></>}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={addFiles} disabled={busy} />
        </label>}
      </div>
      {photos.length === 0 && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#faf7f5] p-3 text-xs font-bold text-[#897b74]"><LockKeyhole className="size-4 text-[#ff5d68]" />연락처·정확한 위치는 사진과 함께 공개되지 않아요.</div>}
      {photos.length > 0 && <p className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#7f736d]"><Check className="size-3.5 text-[#3da37a]" />대표 사진을 바꾸려면 별 아이콘을 눌러주세요.</p>}
      {photos.some((photo) => photo.moderation_status === "rejected") && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">커뮤니티 가이드에 맞지 않는 사진은 다른 회원에게 표시되지 않습니다.</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600" role="alert">{error}</p>}
    </section>
  );
}
