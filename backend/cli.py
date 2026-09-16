import argparse
import json
import sys

from backend.services.render_diagnostics import get_diagnostics


def doctor():
    """Run diagnostics and print results."""
    print("Running AutoTube AI Doctor...")
    diag = get_diagnostics()

    print("\n--- Diagnostic Results ---")
    print(f"OS: {diag['os']} ({diag['arch']})")

    print(f"\nFFmpeg Installed: {diag['ffmpeg']['installed']}")
    if diag["ffmpeg"]["installed"]:
        print(f"Path: {diag['ffmpeg']['path']}")
        print(f"Version: {diag['ffmpeg']['version']}")

    print(f"FFprobe Installed: {diag['ffmpeg']['ffprobe_installed']}")

    print(f"\nVideo Encoder")
    print(f"Preference: {diag['encoder']['preference']}")
    print(f"Selected: {diag['encoder']['selected']}")

    print(f"\nDisk Space (/)")
    print(f"Total: {diag['disk']['total_gb']} GB")
    print(f"Free: {diag['disk']['free_gb']} GB")
    print(f"Used: {diag['disk']['used_gb']} GB")

    print("\n--------------------------")

    issues = 0
    if not diag["ffmpeg"]["installed"] or not diag["ffmpeg"]["ffprobe_installed"]:
        print("[!] FFmpeg or FFprobe is missing!")
        issues += 1
    if diag["disk"]["free_gb"] < 5.0:
        print("[!] Less than 5 GB of free disk space!")
        issues += 1

    if issues == 0:
        print("[✓] Environment looks good!")
        sys.exit(0)
    else:
        print(f"[X] Found {issues} issue(s) that need attention.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="AutoTube AI CLI")
    subparsers = parser.add_subparsers(dest="command")

    doc_parser = subparsers.add_parser("doctor", help="Run system diagnostics")

    args = parser.parse_args()
    if args.command == "doctor":
        doctor()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
