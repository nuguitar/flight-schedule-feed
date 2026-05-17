"""
One-time utility: scan every git commit that touched data/flight_schedule.json
and rebuild the most-complete version of the file by merging all historical
snapshots.

Merge rule for each calendar date:
  Use the entry list from the commit whose fetched_at timestamp is LATEST
  among all commits that contain that date.
  → Newest capture of a date is most accurate (statuses update over time).
  → Dates that fell out of the rolling window are preserved from their last
    known good snapshot.

Non-schedule fields (instructors, resources, leaves) are taken from the
most-recent commit overall.

Usage:
    python3 scripts/rebuild_history.py            # dry-run: just print summary
    python3 scripts/rebuild_history.py --apply    # write data/flight_schedule.json
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT        = Path(__file__).parent.parent
OUTPUT_FILE = ROOT / "data" / "flight_schedule.json"
BACKUP_FILE = ROOT / "data" / "flight_schedule.backup.json"


def git_file_commits(rel_path: str) -> list[str]:
    """Return all commit SHAs (newest first) that touched rel_path."""
    result = subprocess.run(
        ["git", "log", "--format=%H", "--", rel_path],
        capture_output=True, text=True, check=True,
    )
    return [s for s in result.stdout.strip().split("\n") if s]


def load_from_commit(sha: str, rel_path: str):
    result = subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Write merged file; default is dry-run only")
    args = parser.parse_args()

    commits = git_file_commits("data/flight_schedule.json")
    print(f"Found {len(commits)} commits that touched data/flight_schedule.json")

    # best_for_date[date] = (fetched_at_str, entries_list)
    best_for_date = {}  # date -> (fetched_at_str, entries_list)
    latest_meta: dict = {}  # non-schedule fields from the newest commit
    parse_errors = 0

    for i, sha in enumerate(commits):
        data = load_from_commit(sha, "data/flight_schedule.json")
        if data is None:
            print(f"  WARN: could not parse commit {sha[:8]}", file=sys.stderr)
            parse_errors += 1
            continue

        fetched_at = data.get("fetched_at", "")
        schedules  = data.get("schedules", {})

        # Keep non-schedule fields from the NEWEST commit (i == 0)
        if i == 0:
            latest_meta = {k: v for k, v in data.items() if k != "schedules"}

        for date, entries in schedules.items():
            existing = best_for_date.get(date)
            # Use this snapshot if: date not seen yet, OR this fetched_at is newer
            if existing is None or fetched_at > existing[0]:
                best_for_date[date] = (fetched_at, entries)

        if (i + 1) % 10 == 0 or i == len(commits) - 1:
            print(f"  Processed {i+1}/{len(commits)} commits — {len(best_for_date)} unique dates so far")

    sorted_dates = sorted(best_for_date.keys())
    total_entries = sum(len(v) for _, v in best_for_date.values())

    print(f"\nMerge summary:")
    print(f"  Unique dates : {len(sorted_dates)}")
    print(f"  Date range   : {sorted_dates[0]} → {sorted_dates[-1]}")
    print(f"  Total entries: {total_entries}")
    if parse_errors:
        print(f"  Parse errors : {parse_errors} commits skipped")

    # Show per-date source commit info
    print("\nPer-date best snapshot (date  fetched_at  entries):")
    for date in sorted_dates:
        fa, entries = best_for_date[date]
        print(f"  {date}  {fa}  {len(entries):4d} entries")

    if not args.apply:
        print("\nDry-run complete. Pass --apply to write data/flight_schedule.json")
        return

    # Back up existing file before overwriting
    if OUTPUT_FILE.exists():
        BACKUP_FILE.write_bytes(OUTPUT_FILE.read_bytes())
        print(f"\nBacked up existing file → {BACKUP_FILE.name}")

    merged = {
        **latest_meta,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timezone": latest_meta.get("timezone", "Asia/Bangkok"),
        "schedules": {date: entries for date, (_, entries) in sorted(best_for_date.items())},
    }

    OUTPUT_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Written → {OUTPUT_FILE}")
    print(f"  {len(sorted_dates)} dates, {total_entries} entries, range {sorted_dates[0]} → {sorted_dates[-1]}")


if __name__ == "__main__":
    main()
