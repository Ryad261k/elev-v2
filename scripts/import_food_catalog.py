from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.request
from pathlib import Path


def chunked(items, size):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def post_json(url: str, payload: list[dict], api_key: str):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8")


def main():
    parser = argparse.ArgumentParser(description="Import food catalog CSV into Supabase.")
    parser.add_argument("--csv", default="data/off/food_catalog_30000.csv", help="Catalog CSV path.")
    parser.add_argument("--table", default="food_catalog", help="Supabase table name.")
    parser.add_argument("--chunk-size", type=int, default=500, help="Rows per upsert batch.")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    api_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not api_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    with csv_path.open("r", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    endpoint = f"{url.rstrip('/')}/rest/v1/{args.table}?on_conflict=name_normalized,barcode"
    inserted = 0
    for batch in chunked(rows, args.chunk_size):
        payload = []
        for row in batch:
            payload.append({
                "name": row["name"],
                "name_normalized": row["name_normalized"],
                "brand": row["brand"] or None,
                "barcode": row["barcode"] or "",
                "kcal": float(row["kcal"] or 0),
                "protein": float(row["protein"] or 0),
                "carbs": float(row["carbs"] or 0),
                "fat": float(row["fat"] or 0),
                "fibres": float(row["fibres"] or 0) if row["fibres"] else None,
                "sodium": float(row["sodium"] or 0) if row["sodium"] else None,
                "source": row["source"] or "off",
                "popularity": int(float(row["popularity"] or 0)),
            })
        post_json(endpoint, payload, api_key)
        inserted += len(payload)
        print(f"Imported {inserted}/{len(rows)}", file=sys.stderr)

    print(f"Done: {inserted} foods imported into {args.table}")


if __name__ == "__main__":
    main()
