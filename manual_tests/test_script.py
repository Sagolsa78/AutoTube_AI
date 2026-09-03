#!/usr/bin/env python3
"""
MANUAL TEST — Script Generator
Run: python manual_tests/test_script.py "Why do cats purr?" kids_facts
"""
import sys
import json
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
load_dotenv()

from engine.script.generator import generate_script
from engine.quality.checker import check_script


def main():
    topic = sys.argv[1] if len(sys.argv) > 1 else "Why do cats purr?"
    niche = sys.argv[2] if len(sys.argv) > 2 else "kids_facts"

    print(f"\n{'='*60}")
    print(f"  Topic : {topic}")
    print(f"  Niche : {niche}")
    print(f"{'='*60}\n")

    print("⏳ Generating script...")
    script = generate_script(topic, niche)

    print(f"\n✅ Generated via: {script['provider_used']}")
    print(f"\n📌 HOOK:\n   {script['hook']}")
    print(f"\n📝 BODY:")
    for i, line in enumerate(script['body'], 1):
        print(f"   {i}. {line}")
    print(f"\n🎯 PAYOFF:\n   {script['payoff']}")
    print(f"\n📣 CTA:\n   {script['cta']}")
    print(f"\n🔍 VISUAL PROMPTS: {script['visual_prompts']}")
    print(f"\n⏱️  ESTIMATED DURATION: {script['estimated_duration']}s")
    print(f"\n📄 FULL TEXT:\n{script['full_text']}")

    print(f"\n{'='*60}")
    print("  Quality Check")
    print(f"{'='*60}")
    report = check_script(script, niche)
    status = "✅ PASSED" if report.passed else "❌ FAILED"
    print(f"  Score : {report.score}/100  {status}")
    if report.issues:
        print("  Issues:")
        for issue in report.issues:
            print(f"    • {issue}")
    if report.suggestions:
        print("  Suggestions:")
        for sug in report.suggestions:
            print(f"    💡 {sug}")

    # Save raw output for inspection
    out_file = f"manual_tests/output_script_{niche}.json"
    os.makedirs("manual_tests", exist_ok=True)
    with open(out_file, "w") as f:
        json.dump({"script": script, "quality": {"score": report.score, "issues": report.issues}}, f, indent=2)
    print(f"\n💾 Saved → {out_file}")


if __name__ == "__main__":
    main()
