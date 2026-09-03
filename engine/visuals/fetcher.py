"""
Visual fetcher — downloads portrait stock clips from Pexels (primary)
then Pixabay (fallback). Returns paths to local files.
"""
from __future__ import annotations
import logging
import os
import uuid
from pathlib import Path

import requests

from backend.settings import PEXELS_API_KEY, PIXABAY_API_KEY, VISUAL_DIR

log = logging.getLogger(__name__)


def _pexels_fetch(query: str, count: int, out_dir: Path) -> list[str]:
    if not PEXELS_API_KEY:
        log.warning("PEXELS_API_KEY not set — skipping Pexels")
        return []
    headers = {"Authorization": PEXELS_API_KEY}
    try:
        resp = requests.get(
            "https://api.pexels.com/videos/search",
            params={"query": query, "per_page": count, "orientation": "portrait"},
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        videos = resp.json().get("videos", [])
    except Exception as exc:
        log.warning("Pexels search failed for '%s': %s", query, exc)
        return []

    paths = []
    for video in videos:
        # Prefer portrait HD (height > width, height ≥ 1080)
        files = sorted(
            [f for f in video["video_files"] if f["height"] >= 720],
            key=lambda f: f["height"],
            reverse=True,
        )
        portrait = next(
            (f for f in files if f["height"] > f["width"]),
            files[0] if files else None,
        )
        if not portrait:
            continue
        try:
            clip_path = out_dir / f"pexels_{uuid.uuid4().hex[:8]}.mp4"
            chunk_download(portrait["link"], clip_path)
            paths.append({
                "path": str(clip_path),
                "source": "pexels",
                "url": video.get("url", ""),
                "photographer": video.get("user", {}).get("name", ""),
                "license": "Pexels License",
                "commercial_ok": True,
                "attribution_req": False,
            })
        except Exception as exc:
            log.warning("Failed to download Pexels clip: %s", exc)
    return paths


def _pixabay_fetch(query: str, count: int, out_dir: Path) -> list[str]:
    if not PIXABAY_API_KEY:
        log.warning("PIXABAY_API_KEY not set — skipping Pixabay")
        return []
    try:
        resp = requests.get(
            "https://pixabay.com/api/videos/",
            params={
                "key": PIXABAY_API_KEY,
                "q": query,
                "per_page": count,
                "video_type": "film",
            },
            timeout=15,
        )
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
    except Exception as exc:
        log.warning("Pixabay search failed for '%s': %s", query, exc)
        return []

    paths = []
    for hit in hits:
        videos_obj = hit.get("videos", {})
        # Pick medium or large
        file_info = videos_obj.get("medium") or videos_obj.get("large")
        if not file_info:
            continue
        try:
            clip_path = out_dir / f"pixabay_{uuid.uuid4().hex[:8]}.mp4"
            chunk_download(file_info["url"], clip_path)
            paths.append({
                "path": str(clip_path),
                "source": "pixabay",
                "url": hit.get("pageURL", ""),
                "photographer": hit.get("user", ""),
                "license": "Pixabay Content License",
                "commercial_ok": True,
                "attribution_req": False,
            })
        except Exception as exc:
            log.warning("Failed to download Pixabay clip: %s", exc)
    return paths


def chunk_download(url: str, dest: Path, chunk_size: int = 1 << 20):
    """Stream-download a file to avoid loading into memory."""
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=chunk_size):
                f.write(chunk)


def fetch_clips(
    queries: list[str],
    clips_per_query: int = 2,
    out_dir: str | None = None,
) -> list[dict]:
    """
    Fetch stock clips for a list of search queries.
    Falls back from Pexels → Pixabay per query.
    Returns list of asset dicts with path + metadata, shuffled for variety.
    clips_per_query=2 by default so a 3-query script gets up to 6 clips,
    reducing visible repetition in the rendered output.
    """
    import random
    target_dir = Path(out_dir) if out_dir else VISUAL_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    seen_urls: set[str] = set()
    for query in queries:
        clips = _pexels_fetch(query, clips_per_query, target_dir)
        if not clips:
            log.info("Pexels returned nothing for '%s', trying Pixabay", query)
            clips = _pixabay_fetch(query, clips_per_query, target_dir)
        for clip in clips:
            # Deduplicate by source URL to prevent the same video appearing twice
            url = clip.get("url", "")
            if url and url in seen_urls:
                log.debug("Skipping duplicate clip URL: %s", url)
                continue
            seen_urls.add(url)
            results.append(clip)
            log.info("Got clip for query='%s' from %s", query, clip.get("source", "?"))
        if not any(c for c in clips if c.get("url") not in seen_urls):
            log.warning("No unique clips found for query='%s'", query)

    # Shuffle for variety so rendered videos don't cycle clips in the same order
    random.shuffle(results)
    return results


import asyncio

async def async_fetch_clips(
    queries: list[str],
    clips_per_query: int = 1,
    out_dir: str | None = None,
) -> list[dict]:
    """Async wrapper — runs the sync HTTP downloads in a thread pool."""
    return await asyncio.to_thread(fetch_clips, queries, clips_per_query, out_dir)
