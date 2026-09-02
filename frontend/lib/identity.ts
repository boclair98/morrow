"use client";

/**
 * Client-side identity helpers.
 *
 * The browser session is an HttpOnly cookie, so client code intentionally
 * cannot inspect it. We discover identity by fetching `/api/me`:
 *    200 → the backend verified the session and returned the local user
 *    401 → anonymous
 */

import { useEffect, useState } from "react";

import { tracked } from "./warming";
import type { ProfilePhoto } from "./api";

export type Me = {
  id: string;
  coders_id: string;
  display_name: string;
  age: number | null;
  gender: string | null;
  seeking: string | null;
  area: string | null;
  job: string | null;
  bio: string | null;
  date_style: string | null;
  interests: string[];
  availability: string[];
  min_preferred_age: number;
  max_preferred_age: number;
  max_distance_km: number;
  profile_complete: boolean;
  account_verified: boolean;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  verified_at: string | null;
  status: "active" | "suspended" | "banned";
  suspended_until: string | null;
  discoverable: boolean;
  legal_complete: boolean;
  current_terms_version: string;
  current_privacy_version: string;
  notify_matches: boolean;
  notify_messages: boolean;
  notify_dates: boolean;
  marketing_opt_in: boolean;
  is_admin: boolean;
  photos: ProfilePhoto[];
  first_seen_at: string;
};

// `undefined` = still loading; `null` = anonymous; Me = signed in.
export type MeState = Me | null | undefined;

export function useMe(): MeState {
  const [me, setMe] = useState<MeState>(undefined);
  useEffect(() => {
    let alive = true;
    tracked(async () => {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!alive) return;
      if (r.ok) setMe(await r.json());
      else setMe(null);
    }).catch(() => {
      if (alive) setMe(null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return me;
}
