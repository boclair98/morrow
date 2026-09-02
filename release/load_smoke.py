"""Small, dependency-free public deployment concurrency smoke test."""

from __future__ import annotations

import argparse
import json
import statistics
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed


def request(base_url: str, index: int) -> tuple[int, float, str]:
    paths = ("/api/health/live", "/api/health", "/api/auth/providers")
    path = paths[index % len(paths)]
    started = time.perf_counter()
    try:
        browser_request = urllib.request.Request(
            f"{base_url.rstrip('/')}{path}",
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 MORROW-release-smoke/1.0",
            },
        )
        with urllib.request.urlopen(
            browser_request, timeout=15
        ) as response:
            body = response.read(100_000)
            status = response.status
            if path.startswith("/api/health"):
                payload = json.loads(body)
                if payload.get("status") != "ok":
                    return status, time.perf_counter() - started, "invalid-health"
            return status, time.perf_counter() - started, path
    except urllib.error.HTTPError as error:
        return error.code, time.perf_counter() - started, path
    except Exception as error:  # noqa: BLE001 - smoke test reports transport failures
        return 0, time.perf_counter() - started, type(error).__name__


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="https://morrow.coders.kr")
    parser.add_argument("--requests", type=int, default=120)
    parser.add_argument("--concurrency", type=int, default=12)
    args = parser.parse_args()

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [
            pool.submit(request, args.url, index) for index in range(args.requests)
        ]
        results = [future.result() for future in as_completed(futures)]

    statuses = Counter(status for status, _, _ in results)
    durations = sorted(duration for _, duration, _ in results)
    failures = [result for result in results if result[0] != 200]
    p95_index = max(0, int(len(durations) * 0.95) - 1)
    summary = {
        "requests": len(results),
        "statuses": dict(sorted(statuses.items())),
        "median_ms": round(statistics.median(durations) * 1000),
        "p95_ms": round(durations[p95_index] * 1000),
        "failures": len(failures),
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
