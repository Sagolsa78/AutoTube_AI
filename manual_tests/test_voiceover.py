#!/usr/bin/env python3
"""
MANUAL TEST — Voiceover Generator
Run: python manual_tests/test_voiceover.py [optional: path to script JSON]

If no JSON path is given, uses a hardcoded sample script.
"""
import sys
import json
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
load_dotenv()

from engine.tts.voiceover import generate_voiceover, NICHE_VOICES

SAMPLE_SCRIPT = {
    "full_text": (
        "Did you know cats purr for a surprising reason? "
        "Cats first learned to purr thousands of years ago to talk to their mothers. "
        "Kittens can't meow and drink milk at the same time, but they CAN purr! "
        "Scientists also discovered that purring can actually help heal bones — "
        "the vibrations are just the right frequency. "
        "So when your cat purrs on your lap, it might be giving you tiny healing vibrations! "
        "Follow us to learn more amazing stuff!"
    ),
    "niche": "kids_facts",
}


def main():
    niche = "kids_facts"
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        with open(sys.argv[1]) as f:
            data = json.load(f)
        text  = data.get("script", {}).get("full_text", SAMPLE_SCRIPT["full_text"])
        niche = data.get("script", {}).get("niche", niche)
    else:
        text = SAMPLE_SCRIPT["full_text"]

    os.makedirs("storage/audio", exist_ok=True)
    audio_path = "storage/audio/test_voice.mp3"
    sub_path   = "storage/audio/test_subs.ass"

    print(f"\n{'='*60}")
    print(f"  Voice : {NICHE_VOICES.get(niche, 'en-US-GuyNeural')}")
    print(f"  Niche : {niche}")
    print(f"{'='*60}")
    print(f"\n📄 Text to speak:\n{text}\n")

    print("⏳ Generating voiceover...")
    import asyncio
    result = asyncio.run(generate_voiceover(text, niche=niche, audio_path=audio_path, sub_path=sub_path))

    print(f"\n✅ Done!")
    print(f"  Audio  → {result['audio_path']}")
    print(f"  Sub    → {result['sub_path']}")
    print(f"  Duration: {result['duration']:.2f}s")
    print(f"  Voice  : {result['voice']}")
    print(f"  Words  : {len(result.get('word_boundaries', []))} boundary events")

    # Print first few subtitle lines
    if os.path.exists(sub_path):
        lines = open(sub_path).readlines()[:20]
        print(f"\n📝 First subtitle lines:\n{''.join(lines)}")


if __name__ == "__main__":
    main()
