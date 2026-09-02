"use client";

import { CalendarDays, Check, Save, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import {
  type ProfileDetailsInput,
  updateProfile,
} from "@/lib/api";
import type { Me } from "@/lib/identity";

const areas = [
  "성수",
  "연남",
  "강남",
  "잠실",
  "한남",
  "을지로",
  "망원",
  "신촌",
  "여의도",
  "인천",
  "수원",
  "성남",
  "고양",
  "용인",
  "대전",
  "세종",
  "부산",
  "대구",
  "광주",
  "울산",
  "창원",
  "제주",
  "기타",
] as const;

const interests = [
  "카페",
  "전시",
  "맛집",
  "산책",
  "러닝",
  "영화",
  "음악",
  "여행",
  "독서",
  "요리",
  "반려동물",
  "운동",
] as const;

const availabilityOptions = [
  "평일 저녁",
  "금요일 밤",
  "토요일 낮",
  "토요일 저녁",
  "일요일 낮",
  "일요일 저녁",
] as const;

const dateStyleSuggestions = [
  "대화가 잘 통하는 편안한 데이트",
  "새로운 장소를 발견하는 데이트",
  "맛있는 걸 함께 즐기는 데이트",
  "활동적인 야외 데이트",
] as const;

function initialProfile(me: Me): ProfileDetailsInput {
  return {
    display_name: me.display_name,
    age: me.age ?? 20,
    gender:
      me.gender === "man" || me.gender === "other" ? me.gender : "woman",
    seeking:
      me.seeking === "woman" || me.seeking === "all" ? me.seeking : "man",
    area: me.area || "성수",
    job: me.job || "",
    bio: me.bio || "",
    date_style: me.date_style || dateStyleSuggestions[0],
    interests: me.interests,
    availability: me.availability,
    min_preferred_age: me.min_preferred_age,
    max_preferred_age: me.max_preferred_age,
    max_distance_km: me.max_distance_km,
  };
}

export function ProfileEditor({
  me,
  onCancel,
  onSaved,
}: {
  me: Me;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProfileDetailsInput>(() => initialProfile(me));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    form.display_name.trim().length > 0 &&
    form.job.trim().length > 0 &&
    form.bio.trim().length >= 10 &&
    form.date_style.trim().length > 0 &&
    form.interests.length >= 3 &&
    form.availability.length > 0 &&
    form.min_preferred_age <= form.max_preferred_age;

  function toggleInterest(item: string) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(item)
        ? current.interests.filter((value) => value !== item)
        : current.interests.length < 6
          ? [...current.interests, item]
          : current.interests,
    }));
  }

  function toggleAvailability(item: string) {
    setForm((current) => ({
      ...current,
      availability: current.availability.includes(item)
        ? current.availability.filter((value) => value !== item)
        : current.availability.length < 4
          ? [...current.availability, item]
          : current.availability,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        ...form,
        display_name: form.display_name.trim(),
        job: form.job.trim(),
        bio: form.bio.trim(),
        date_style: form.date_style.trim(),
      });
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요",
      );
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <form
        onSubmit={submit}
        className="rounded-[28px] border border-[#eadfe3] bg-white p-5 shadow-[0_18px_55px_rgba(73,30,48,0.06)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.08em] text-[#f03768]">
              EDIT PROFILE
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              내 프로필 편집
            </h1>
            <p className="mt-2 text-sm font-medium text-[#82747a]">
              저장한 내용은 다음 추천부터 바로 반영돼요.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[#eadfe3] text-[#6f6267] hover:border-[#b9aaaf]"
            aria-label="프로필 편집 닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <EditorField label="표시 이름">
            <input
              required
              maxLength={20}
              value={form.display_name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  display_name: event.target.value,
                }))
              }
              className="morrow-input"
            />
          </EditorField>
          <EditorField label="나이">
            <input
              required
              type="number"
              min={20}
              max={49}
              value={form.age}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  age: Number(event.target.value),
                }))
              }
              className="morrow-input"
            />
          </EditorField>
          <EditorField label="나는">
            <select
              value={form.gender}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  gender: event.target.value as ProfileDetailsInput["gender"],
                }))
              }
              className="morrow-input"
            >
              <option value="woman">여성</option>
              <option value="man">남성</option>
              <option value="other">기타</option>
            </select>
          </EditorField>
          <EditorField label="만나고 싶은 사람">
            <select
              value={form.seeking}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  seeking: event.target.value as ProfileDetailsInput["seeking"],
                }))
              }
              className="morrow-input"
            >
              <option value="man">남성</option>
              <option value="woman">여성</option>
              <option value="all">모두</option>
            </select>
          </EditorField>
          <EditorField label="주 활동 지역">
            <select
              value={form.area}
              onChange={(event) =>
                setForm((current) => ({ ...current, area: event.target.value }))
              }
              className="morrow-input"
            >
              {areas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </EditorField>
          <EditorField label="하는 일">
            <input
              required
              maxLength={48}
              value={form.job}
              onChange={(event) =>
                setForm((current) => ({ ...current, job: event.target.value }))
              }
              className="morrow-input"
            />
          </EditorField>
          <EditorField label="선호 최소 나이">
            <input
              required
              type="number"
              min={20}
              max={49}
              value={form.min_preferred_age}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  min_preferred_age: Number(event.target.value),
                }))
              }
              className="morrow-input"
            />
          </EditorField>
          <EditorField label="선호 최대 나이">
            <input
              required
              type="number"
              min={20}
              max={49}
              value={form.max_preferred_age}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  max_preferred_age: Number(event.target.value),
                }))
              }
              className="morrow-input"
            />
          </EditorField>
          <EditorField label="추천 거리">
            <select
              value={form.max_distance_km}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  max_distance_km: Number(event.target.value),
                }))
              }
              className="morrow-input"
            >
              {[10, 20, 30, 50, 100, 200].map((distance) => (
                <option key={distance} value={distance}>{distance}km 이내</option>
              ))}
            </select>
          </EditorField>
        </div>

        <EditorField label="짧은 소개" className="mt-5">
          <textarea
            required
            minLength={10}
            maxLength={240}
            value={form.bio}
            onChange={(event) =>
              setForm((current) => ({ ...current, bio: event.target.value }))
            }
            className="morrow-input min-h-28 resize-none py-3"
          />
          <p className="mt-1 text-right text-[11px] font-medium text-[#a09297]">
            {form.bio.length}/240
          </p>
        </EditorField>

        <EditorField label="선호하는 데이트" className="mt-5">
          <input
            required
            maxLength={32}
            value={form.date_style}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                date_style: event.target.value,
              }))
            }
            className="morrow-input"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {dateStyleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    date_style: suggestion,
                  }))
                }
                className="rounded-full border border-[#eadfe3] px-3 py-2 text-xs font-bold text-[#74666b] hover:border-[#f03768] hover:text-[#f03768]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </EditorField>

        <fieldset className="mt-6">
          <legend className="text-sm font-black">
            관심사 <span className="font-semibold text-[#a09297]">3~6개</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {interests.map((item) => (
              <ChoiceButton
                key={item}
                active={form.interests.includes(item)}
                onClick={() => toggleInterest(item)}
              >
                #{item}
              </ChoiceButton>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="flex items-center gap-2 text-sm font-black">
            <CalendarDays className="size-4 text-[#f03768]" /> 가능한 시간
            <span className="font-semibold text-[#a09297]">1~4개</span>
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {availabilityOptions.map((item) => (
              <ChoiceButton
                key={item}
                active={form.availability.includes(item)}
                onClick={() => toggleAvailability(item)}
                wide
              >
                {item}
              </ChoiceButton>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {!valid ? (
          <p className="mt-5 text-xs font-semibold text-[#9b8c91]">
            소개 10자 이상, 관심사 3개 이상, 가능한 시간 1개 이상을 입력해주세요.
          </p>
        ) : null}

        <div className="mt-7 grid grid-cols-[1fr_1.5fr] gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-xl border border-[#ded2d6] text-sm font-black"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#171014] text-sm font-black text-white disabled:opacity-40"
          >
            <Save className="size-4" />
            {busy ? "저장 중..." : "저장하고 추천 갱신"}
          </button>
        </div>
      </form>
    </section>
  );
}

function EditorField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-black text-[#55494e] ${className}`}>
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
  wide = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition ${
        wide ? "w-full" : ""
      } ${
        active
          ? "border-[#f03768] bg-[#fff0f4] text-[#e32b5a]"
          : "border-[#e5dade] bg-white text-[#716368] hover:border-[#bfb0b5]"
      }`}
    >
      {active ? <Check className="size-3.5" /> : null}
      {children}
    </button>
  );
}
