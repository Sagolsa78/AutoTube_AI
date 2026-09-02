#!/usr/bin/env python3
"""
MANUAL TEST — Visuals Fetcher
Run: python manual_tests/test_visuals.py "cat" "kitten" "butterfly"

Queries can be passed as CLI arguments (space-separated).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from engine.visuals.fetcher import fetch_clips


def main():
    queries = sys.argv[1:] if len(sys.argv) > 1 else ["cat", "butterfly", "bee"]
    print(f"\n{'='*60}")
    print(f"  Searching for clips: {queries}")
    print(f"{'='*60}\n")

    print("⏳ Fetching clips...")
    clips = fetch_clips(queries, clips_per_query=1, out_dir="storage/visuals/test")

    if not clips:
        print("\n❌ No clips returned — check your API keys in .env")
        return

    print(f"\n✅ Downloaded {len(clips)} clip(s):\n")
    for i, clip in enumerate(clips, 1):
        print(f"  {i}. {clip['path']}")
        print(f"     Source      : {clip['source']}")
        print(f"     Photographer: {clip.get('photographer', 'N/A')}")
        print(f"     License     : {clip['license']}")
        print(f"     Commercial  : {'✅' if clip['commercial_ok'] else '❌'}")
        print()


if __name__ == "__main__":
    main()
