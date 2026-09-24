"""
Visual fetcher — handles searching and downloading portrait stock clips from Pexels (primary)
then Pixabay (fallback).
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

import requests

from backend.core.config import settings
from backend.settings import PEXELS_API_KEY, PIXABAY_API_KEY, VISUAL_DIR

log = logging.getLogger(__name__)


def _search_coverr(query: str, count: int) -> list[dict]:
    results = []
    if not settings.COVERR_ENABLED:
        return results

    try:
        # Coverr doesn't require an API key for the public JSON search
        resp = requests.get(
            "https://api.coverr.co/videos",
            params={"query": query, "urls": "true"},
            timeout=15,
        )
        resp.raise_for_status()

        for video in resp.json().get("hits", []):
            urls = video.get("urls", {})
            download_url = urls.get("mp4") or urls.get("poster")
            if not download_url:
                continue

            results.append(
                {
                    "source": "coverr",
                    "source_asset_id": str(video.get("id", "")),
                    "thumbnail_url": urls.get("thumbnail", ""),
                    "url": f"https://coverr.co/videos/{video.get('id', '')}",
                    "download_url": download_url,
                    "duration": video.get("duration", 0),
                    "width": 1080,  # Coverr standardizes HD
                    "height": 1920,  # Treat as portrait compatible usually
                    "photographer": video.get("user", {}).get("first_name", "Coverr"),
                    "license": "Coverr License",
                    "commercial_ok": True,
                    "attribution_req": False,
                    "asset_metadata": video,
                }
            )
            if len(results) >= count:
                break
    except Exception as exc:
        log.warning("Coverr search failed for '%s': %s", query, exc)
    return results


def _search_pexels(query: str, count: int) -> list[dict]:
    results = []
    if not PEXELS_API_KEY:
        return results

    headers = {"Authorization": PEXELS_API_KEY}
    try:
        resp = requests.get(
            "https://api.pexels.com/videos/search",
            params={"query": query, "per_page": count, "orientation": "portrait"},
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        for video in resp.json().get("videos", []):
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
            results.append(
                {
                    "source": "pexels",
                    "source_asset_id": str(video.get("id", "")),
                    "thumbnail_url": video.get("image", ""),
                    "url": video.get("url", ""),
                    "download_url": portrait["link"],
                    "duration": video.get("duration", 0),
                    "width": portrait.get("width", 0),
                    "height": portrait.get("height", 0),
                    "photographer": video.get("user", {}).get("name", ""),
                    "license": "Pexels License",
                    "commercial_ok": True,
                    "attribution_req": False,
                    "asset_metadata": video,
                }
            )
    except Exception as exc:
        log.warning("Pexels search failed for '%s': %s", query, exc)
    return results


def _search_pixabay(query: str, count: int) -> list[dict]:
    results = []
    if not PIXABAY_API_KEY:
        return results

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
        for hit in resp.json().get("hits", []):
            videos_obj = hit.get("videos", {})
            file_info = videos_obj.get("medium") or videos_obj.get("large")
            if not file_info:
                continue

            # Prefer portrait clips (height > width)
            if file_info.get("height", 0) <= file_info.get("width", 0):
                # Penalty: skip landscape unless we really need it, but let intelligence.py handle it mostly
                pass

            results.append(
                {
                    "source": "pixabay",
                    "source_asset_id": str(hit.get("id", "")),
                    "thumbnail_url": (
                        f"https://i.vimeocdn.com/video/{hit.get('picture_id')}_640x360.jpg"
                        if hit.get("picture_id")
                        else ""
                    ),
                    "url": hit.get("pageURL", ""),
                    "download_url": file_info["url"],
                    "duration": hit.get("duration", 0),
                    "width": file_info.get("width", 0),
                    "height": file_info.get("height", 0),
                    "photographer": hit.get("user", ""),
                    "license": "Pixabay Content License",
                    "commercial_ok": True,
                    "attribution_req": False,
                    "asset_metadata": hit,
                }
            )
    except Exception as exc:
        log.warning("Pixabay search failed for '%s': %s", query, exc)
    return results


def search_clips(query: str, count: int = 5) -> list[dict]:
    """Search for clips across configured providers based on STOCK_PROVIDER_ORDER."""
    results = []
    providers = settings.parsed_stock_provider_order

    # We query providers sequentially in order, stopping when we have enough clips
    for provider in providers:
        if len(results) >= count:
            break

        remaining = count - len(results)
        if provider == "pexels":
            results.extend(_search_pexels(query, remaining))
        elif provider == "coverr":
            results.extend(_search_coverr(query, remaining))
        elif provider == "pixabay":
            results.extend(_search_pixabay(query, remaining))

    return results[:count]


async def async_search_clips(query: str, count: int = 5) -> list[dict]:
    return await asyncio.to_thread(search_clips, query, count)


def chunk_download(url: str, dest: Path, chunk_size: int = 1 << 20):
    """Stream-download a file to avoid loading into memory, with retries and validation."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_dest = dest.with_suffix(".tmp")

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with requests.get(url, stream=True, timeout=(15, 30)) as r:
                r.raise_for_status()
                with open(tmp_dest, "wb") as f:
                    for chunk in r.iter_content(chunk_size=chunk_size):
                        f.write(chunk)

            if not tmp_dest.exists() or tmp_dest.stat().st_size == 0:
                raise ValueError("Downloaded file is empty")

            cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(tmp_dest),
            ]
            out = (
                subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode().strip()
            )
            if not out or float(out) <= 0:
                raise ValueError(f"Invalid media duration: {out}")

            tmp_dest.rename(dest)
            return
        except Exception as e:
            if tmp_dest.exists():
                tmp_dest.unlink()
            if attempt == max_retries - 1:
                raise RuntimeError(f"Download failed after {max_retries} attempts: {e}")
            time.sleep(2 * (attempt + 1))


async def async_download_clip(
    url: str, out_dir: str | Path, source: str = "asset"
) -> str:
    """Download a clip and return the local path."""
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    clip_path = out_path / f"{source}_{uuid.uuid4().hex[:8]}.mp4"
    await asyncio.to_thread(chunk_download, url, clip_path)
    return str(clip_path)


async def async_fetch_clips(
    queries: list[str],
    clips_per_query: int = 1,
    out_dir: str | None = None,
) -> list[dict]:
    """
    Legacy wrapper for scene-aware assembly backward compatibility.
    Searches and downloads clips automatically.
    """
    target_dir = out_dir if out_dir else VISUAL_DIR
    results = []

    for query in queries:
        clips = await async_search_clips(query, count=clips_per_query)
        if clips:
            clip = clips[0]  # Just take the top result
            try:
                local_path = await async_download_clip(
                    clip["download_url"], target_dir, clip["source"]
                )
                clip["path"] = local_path
                results.append(clip)
            except Exception as e:
                log.warning("Failed to download clip for query '%s': %s", query, e)

    return results
