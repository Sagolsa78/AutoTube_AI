#!/usr/bin/env python3
"""
MANUAL TEST — Full end-to-end pipeline (no upload).
Run: python manual_tests/test_full_pipeline.py "Why do cats purr?" kids_facts

Produces a local MP4 in storage/renders/ for your review.
"""
import sys
import os
import glob
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
load_dotenv()


def main():
    topic = sys.argv[1] if len(sys.argv) > 1 else "Why do cats purr?"
    niche = sys.argv[2] if len(sys.argv) > 2 else "kids_facts"

    print(f"\n{'='*60}")
    print(f"  🎬 AutoShorts Full Pipeline Test")
    print(f"  Topic : {topic}")
    print(f"  Niche : {niche}")
    print(f"{'='*60}\n")

    # ── Step 1: Script ─────────────────────────────────────────────────────────
    from engine.script.generator import generate_script
    from engine.quality.checker import check_script
    print("Step 1/4 — Generating script...")
    script = generate_script(topic, niche)
    report = check_script(script, niche)
    print(f"  ✅ Script [{script['provider_used']}] — Quality: {report.score}/100")
    if not report.passed:
        print(f"  ⚠️  Quality below threshold. Issues: {report.issues}")
        ans = input("  Continue anyway? [y/N]: ")
        if ans.lower() != "y":
            print("  Aborted.")
            return

    # ── Step 2: Voiceover ──────────────────────────────────────────────────────
    from engine.tts.voiceover import generate_voiceover
    print("\nStep 2/4 — Generating voiceover...")
    os.makedirs("storage/audio", exist_ok=True)
    import asyncio
    tts = asyncio.run(generate_voiceover(
        script["full_text"],
        niche=niche,
        audio_path="storage/audio/pipeline_voice.mp3",
        sub_path="storage/audio/pipeline_subs.ass",
    ))
    print(f"  ✅ Audio: {tts['audio_path']}  ({tts['duration']:.1f}s)")
    print(f"  ✅ Word boundaries: {len(tts.get('word_boundaries', []))} events")

    # ── Step 3: Visuals ────────────────────────────────────────────────────────
    from engine.visuals.fetcher import fetch_clips
    print("\nStep 3/4 — Fetching visuals...")
    os.makedirs("storage/visuals", exist_ok=True)
    clips = fetch_clips(
        script.get("visual_prompts", [topic])[:3],
        clips_per_query=1,
        out_dir="storage/visuals",
    )
    if not clips:
        print("  ⚠️  No clips found — using any existing test clips if available")
        clips = [{"path": p} for p in glob.glob("storage/visuals/test/*.mp4")]
    if not clips:
        print("  ❌ No clips at all — cannot assemble. Check API keys.")
        return
    clip_paths = [c["path"] for c in clips]
    print(f"  ✅ Got {len(clip_paths)} clip(s)")

    # ── Step 4: Assembly ───────────────────────────────────────────────────────
    from engine.rendering.assembler import assemble_video
    print("\nStep 4/4 — Assembling video...")
    video_path = assemble_video(
        clip_paths,
        audio_path=tts["audio_path"],
        srt_path=tts["sub_path"],
        style="fast_facts",
        word_boundaries=tts.get("word_boundaries"),
    )
    print(f"\n{'='*60}")
    print(f"  🎉 DONE!  Video saved → {video_path}")
    print(f"  Open it and review before uploading.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
