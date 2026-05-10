import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

SCRIPT_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbzsOcPHLUpD5U8Qyq-x78edIOMUr28NJAp0KTvJvYCW6IQ_yG-HB97aRue8aFoxGQ5lJg/exec"
)
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "flight_schedule.json"
LOAD_TIMEOUT_MS = 60_000   # 60 s total page load budget
POLL_INTERVAL_MS = 500     # check every 0.5 s
MAX_POLL_TRIES = 60        # 30 s of polling after page load

TIMEZONE = "Asia/Bangkok"
VALID_STATUSES = {"Pending", "Completed", "Canceled"}


def _null_dash(value):
    return None if value == "-" else value


def _null_empty(value):
    return None if value == "" else value


def _parse_duration_min(duration_str):
    """Convert 'HH:MM' to total minutes as int, or None if unparseable."""
    try:
        h, m = duration_str.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return None


def normalize_entry(entry, date):
    """Return a normalized schedule entry ready for dashboard consumption."""
    raw_row_idx = entry.get("rowIdx")
    try:
        row_idx = int(raw_row_idx)
    except (TypeError, ValueError):
        row_idx = raw_row_idx

    duration_str = entry.get("duration") or ""
    ac_type = entry.get("type") or ""
    status = entry.get("status")

    return {
        "id": str(raw_row_idx),
        "date": date,
        "rowIdx": row_idx,
        "status": status if status in VALID_STATUSES else "Pending",
        "isActual": bool(entry.get("isActual", False)),
        "isSimulator": "(SIM)" in ac_type,
        # scheduling
        "start": entry.get("start"),
        "end": entry.get("end"),
        "duration": duration_str or None,
        "durationMin": _parse_duration_min(duration_str),
        # people
        "student": _null_dash(entry.get("student")),
        "instructor": _null_dash(entry.get("instructor")),
        "batch": entry.get("batch"),
        "lesson": entry.get("lesson"),
        "condition": _null_empty(_null_dash(entry.get("condition"))),
        # aircraft
        "type": _null_empty(_null_dash(ac_type)),
        "tail": _null_dash(entry.get("tail")),
        # actuals (populated after flight)
        "actualType": _null_empty(entry.get("actualType")),
        "tkoff": _null_dash(entry.get("tkoff")),
        "ldgTime": _null_dash(entry.get("ldgTime")),
        "airborne": _null_dash(entry.get("airborne")),
        "ldg": entry.get("ldg"),
        "to": entry.get("to"),
        "inst": entry.get("inst"),
    }


async def get_iframe_flight_cache(page):
    """Return the flightCache object from inside the sandbox iframe."""
    # The iframe src is set dynamically; wait for it to appear.
    await page.wait_for_selector("#sandboxFrame", timeout=LOAD_TIMEOUT_MS)

    # Give the iframe a moment to receive its src and start loading.
    await page.wait_for_timeout(2000)

    sandbox_frame = None
    for _ in range(MAX_POLL_TRIES):
        # Playwright exposes all frames including cross-origin ones.
        for frame in page.frames:
            if frame == page.main_frame:
                continue
            try:
                cache = await frame.evaluate(
                    "() => (typeof window.flightCache !== 'undefined' && "
                    "window.flightCache.schedules && "
                    "Object.keys(window.flightCache.schedules).length > 0) "
                    "? window.flightCache : null"
                )
                if cache:
                    return cache
            except Exception:
                pass
        await page.wait_for_timeout(POLL_INTERVAL_MS)

    # Last attempt — return whatever is there even if schedules is empty.
    for frame in page.frames:
        if frame == page.main_frame:
            continue
        try:
            cache = await frame.evaluate(
                "() => typeof window.flightCache !== 'undefined' ? window.flightCache : null"
            )
            if cache is not None:
                return cache
        except Exception:
            pass

    return None


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        print(f"Navigating to {SCRIPT_URL} …")
        try:
            await page.goto(SCRIPT_URL, wait_until="domcontentloaded", timeout=LOAD_TIMEOUT_MS)
        except PlaywrightTimeoutError:
            print("ERROR: Page load timed out.", file=sys.stderr)
            await browser.close()
            sys.exit(1)

        print("Waiting for flight cache data …")
        cache = await get_iframe_flight_cache(page)
        await browser.close()

    if cache is None:
        print("ERROR: Could not retrieve flightCache from the page.", file=sys.stderr)
        sys.exit(1)

    raw_schedules = cache.get("schedules", {})
    normalized_schedules = {
        date: [normalize_entry(entry, date) for entry in entries]
        for date, entries in raw_schedules.items()
    }

    output = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timezone": TIMEZONE,
        "schedules": normalized_schedules,
        "leaves": cache.get("leaves", []),
        "instructors": cache.get("instructors", []),
        "resources": cache.get("resources", []),
    }

    schedule_count = sum(len(v) for v in output["schedules"].values())
    date_count = len(output["schedules"])
    print(f"Fetched {schedule_count} flights across {date_count} date(s).")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved → {OUTPUT_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
