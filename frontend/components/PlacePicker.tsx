"use client";

import { ExternalLink, MapPin, Search } from "lucide-react";
import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";

import {
  fetchAuthProviders,
  searchKakaoPlaces,
  type KakaoPlace,
} from "@/lib/api";

type KakaoMaps = {
  load: (callback: () => void) => void;
  LatLng: new (latitude: number, longitude: number) => unknown;
  Map: new (element: HTMLElement, options: { center: unknown; level: number }) => unknown;
  Marker: new (options: { map: unknown; position: unknown }) => unknown;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

export function PlacePicker({
  area,
  selected,
  onSelect,
}: {
  area: string;
  selected: KakaoPlace | null;
  onSelect: (place: KakaoPlace) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KakaoPlace[]>([]);
  const [mapKey, setMapKey] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAuthProviders()
      .then((config) => setMapKey(config.kakao_map_js_key))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selected || !mapReady || !mapHost.current || !window.kakao?.maps) return;
    window.kakao.maps.load(() => {
      if (!selected || !mapHost.current || !window.kakao?.maps) return;
      const center = new window.kakao.maps.LatLng(selected.latitude, selected.longitude);
      const map = new window.kakao.maps.Map(mapHost.current, { center, level: 3 });
      new window.kakao.maps.Marker({ map, position: center });
    });
  }, [mapReady, selected]);

  async function search(event: FormEvent) {
    event.preventDefault();
    const keyword = `${area === "기타" ? "" : area} ${query}`.trim();
    if (keyword.length < 2 || searching) return;
    setSearching(true);
    setError(null);
    try {
      const result = await searchKakaoPlaces(keyword);
      setItems(result.items);
      if (result.items.length === 0) setError("검색 결과가 없어요. 장소명을 더 구체적으로 입력해보세요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "장소를 검색하지 못했어요.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#e7e1dd] bg-[#faf9f8] p-3">
      {mapKey ? (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(mapKey)}&autoload=false`}
          strategy="afterInteractive"
          onLoad={() => setMapReady(true)}
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#111]">카카오맵에서 만날 장소 찾기</p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#8a817d]">공개된 카페·식당처럼 사람이 있는 장소를 권해요.</p>
        </div>
        <MapPin className="size-4 shrink-0 text-[#ff385c]" />
      </div>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">장소명 검색</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={60}
            placeholder="카페나 식당 이름"
            className="h-10 w-full rounded-lg border border-[#ddd] bg-white pl-9 pr-3 text-xs font-semibold outline-none focus:border-black"
          />
        </label>
        <button
          disabled={!query.trim() || searching}
          className="h-10 rounded-lg bg-black px-4 text-xs font-black text-white disabled:opacity-40"
        >
          {searching ? "검색 중" : "검색"}
        </button>
      </form>
      {error ? <p className="mt-2 text-[11px] font-bold leading-5 text-red-600">{error}</p> : null}
      {items.length > 0 ? (
        <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto" aria-label="카카오 장소 검색 결과">
          {items.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => onSelect(place)}
              aria-pressed={selected?.id === place.id}
              className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === place.id ? "border-[#ff7890] bg-[#fff0f3]" : "border-[#e4e0de] bg-white hover:border-[#aaa]"}`}
            >
              <p className="truncate text-xs font-black text-[#222]">{place.name}</p>
              <p className="mt-1 truncate text-[10px] font-semibold text-[#777]">{place.address || place.category}</p>
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[#ddd] bg-white">
          {mapKey ? <div ref={mapHost} className="h-36 w-full bg-[#eee]" aria-label={`${selected.name} 지도`} /> : null}
          <div className="p-3">
            <p className="text-xs font-black">{selected.name}</p>
            <p className="mt-1 text-[10px] font-semibold text-[#777]">{selected.address}</p>
            <a
              href={selected.place_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#ff385c]"
            >
              카카오맵에서 확인 <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
