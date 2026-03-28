from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import re
import sys
import urllib.request
import unicodedata
from pathlib import Path


DEFAULT_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz"
FRANCE_TAGS = {"en:france", "fr:france"}


def normalize(value: str) -> str:
    value = (value or "").strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", value)


def nutrient_value(nutriments: dict, key: str, fallback: float | None = None) -> float | None:
    value = nutriments.get(key)
    if value in (None, "") and key.endswith("_100g"):
        value = nutriments.get(key[:-5])
    if value in (None, ""):
        return fallback
    try:
        return float(value)
    except Exception:
        return fallback


def sold_in_france(product: dict) -> bool:
    tags = {str(tag).strip().lower() for tag in (product.get("countries_tags") or []) if str(tag).strip()}
    if tags & FRANCE_TAGS:
        return True
    countries = normalize(product.get("countries") or "")
    return "france" in countries or "francais" in countries


def sane_per_100g(kcal: float | None, protein: float | None, carbs: float | None, fat: float | None, fibres: float | None, sodium_mg: float | None) -> bool:
    if kcal is None:
        return False
    if kcal < 0 or kcal > 950:
        return False
    if protein is None or protein < 0 or protein > 100:
        return False
    if carbs is None or carbs < 0 or carbs > 100:
        return False
    if fat is None or fat < 0 or fat > 100:
        return False
    if fibres is not None and (fibres < 0 or fibres > 100):
        return False
    if sodium_mg is not None and (sodium_mg < 0 or sodium_mg > 40000):
        return False
    return True


def compute_score(product: dict) -> int:
    score = 0
    score += int(product.get("completeness", 0) * 100)
    score += int(math.log10(max(1, int(product.get("unique_scans_n", 0) or 0))) * 180)
    score += int(math.log10(max(1, int(product.get("popularity_key", 0) or 0))) * 260)
    if product.get("product_name_fr") or product.get("product_name"):
        score += 100
    if product.get("product_name_fr"):
        score += 180
    if product.get("brands"):
        score += 20
    if sold_in_france(product):
        score += 900
    return score


def iter_products(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def download_dump(url: str, target: Path):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url) as resp, target.open("wb") as out:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)


def build_catalog(dump_path: Path, output_path: Path, limit: int):
    best: dict[str, dict] = {}
    for product in iter_products(dump_path):
        nutriments = product.get("nutriments") or {}
        name = (product.get("product_name_fr") or product.get("product_name") or "").strip()
        if len(name) < 2:
            continue

        kcal = nutrient_value(nutriments, "energy-kcal_100g")
        if kcal is None:
            energy = nutrient_value(nutriments, "energy_100g", 0)
            kcal = round(energy / 4.184, 2) if energy else None
        protein = nutrient_value(nutriments, "proteins_100g", 0)
        carbs = nutrient_value(nutriments, "carbohydrates_100g", 0)
        fat = nutrient_value(nutriments, "fat_100g", 0)
        fibres = round(nutrient_value(nutriments, "fiber_100g", 0) or 0, 2)
        sodium = round((nutrient_value(nutriments, "sodium_100g", 0) or 0) * 1000, 2)
        if kcal is None or (protein == 0 and carbs == 0 and fat == 0):
            continue
        if not sane_per_100g(kcal, protein, carbs, fat, fibres, sodium):
            continue

        barcode = str(product.get("code") or "").strip()
        key = f"{normalize(name)}::{barcode}"
        candidate = {
            "name": name,
            "name_normalized": normalize(name),
            "brand": (product.get("brands") or "").split(",")[0].strip() or "",
            "barcode": barcode,
            "kcal": round(kcal or 0, 2),
            "protein": round(protein or 0, 2),
            "carbs": round(carbs or 0, 2),
            "fat": round(fat or 0, 2),
            "fibres": fibres,
            "sodium": sodium,
            "source": "off",
            "sold_in_fr": sold_in_france(product),
            "popularity": compute_score(product),
        }
        previous = best.get(key)
        if not previous or candidate["popularity"] > previous["popularity"]:
            best[key] = candidate

    rows = sorted(best.values(), key=lambda item: (-item["popularity"], item["name"]))[:limit]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["name", "name_normalized", "brand", "barcode", "kcal", "protein", "carbs", "fat", "fibres", "sodium", "source", "sold_in_fr", "popularity"],
        )
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Build a 30k OFF catalog CSV for Supabase import.")
    parser.add_argument("--download", action="store_true", help="Download the OFF dump before building.")
    parser.add_argument("--url", default=DEFAULT_URL, help="OFF dump URL.")
    parser.add_argument("--dump", default="data/off/openfoodfacts-products.jsonl.gz", help="Local OFF dump path.")
    parser.add_argument("--output", default="data/off/food_catalog_30000.csv", help="Output CSV path.")
    parser.add_argument("--limit", type=int, default=30000, help="Number of foods to keep.")
    args = parser.parse_args()

    dump_path = Path(args.dump)
    if args.download or not dump_path.exists():
        print(f"Downloading OFF dump from {args.url} ...", file=sys.stderr)
        download_dump(args.url, dump_path)

    count = build_catalog(dump_path, Path(args.output), args.limit)
    print(f"Built {count} foods into {args.output}")


if __name__ == "__main__":
    main()
