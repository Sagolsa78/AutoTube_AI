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
        headers = {}
        params = {"query": query, "urls": "true", "page_size": count}
        # Coverr API v2 uses Bearer token authentication
        if settings.COVERR_API_KEY:
            headers["Authorization"] = f"Bearer {settings.COVERR_API_KEY}"

        resp = requests.get(
            "https://api.coverr.co/videos",
            params=params,
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        for video in data.get("hits", []):
            urls = video.get("urls") or {}
            download_url = (
                urls.get("mp4")
                or urls.get("mp4_download")
                or urls.get("download")
                or urls.get("hd")
                or urls.get("sd")
            )

            video_id = video.get("id", "")
            if not download_url and video_id:
                download_url = f"https://storage.coverr.co/videos/{video_id}"

            thumbnail_url = (
                video.get("thumbnail")
                or video.get("poster")
                or urls.get("thumbnail")
                or urls.get("poster")
                or ""
            )

            if not download_url:
                log.debug("Coverr: skipping video %s — no download URL", video_id)
                continue

            is_vertical = video.get("is_vertical", False)
            try:
                duration = float(video.get("duration", 0) or 0)
            except (ValueError, TypeError):
                duration = 0.0

            results.append(
                {
                    "source": "coverr",
                    "source_asset_id": str(video_id),
                    "thumbnail_url": thumbnail_url,
                    "url": f"https://coverr.co/videos/{video_id}",
                    "download_url": download_url,
                    "duration": duration,
                    "width": 1080 if is_vertical else 1920,
                    "height": 1920 if is_vertical else 1080,
                    "photographer": (
                        video.get("user", {}).get("first_name", "Coverr")
                        if isinstance(video.get("user"), dict)
                        else "Coverr"
                    ),
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


def search_clips(
    query: str, count: int = 5, provider_override: str = None
) -> list[dict]:
    """Search for clips across configured providers based on STOCK_PROVIDER_ORDER.

    Uses a round-robin distribution strategy: each enabled provider gets a fair
    share of the requested count so that clips from all providers (e.g. Coverr)
    are always included in the mix, not just the first provider.
    """
    if provider_override:
        providers = [provider_override]
    else:
        providers = settings.parsed_stock_provider_order

    if not providers:
        return []

    # ── Round-robin distribution across providers ────────────────────────
    # Distribute `count` across providers so each gets at least 1 clip.
    # E.g. count=5, providers=[pexels, coverr, pixabay] → 2, 2, 1
    per_provider = max(1, count // len(providers))
    remainder = count % len(providers)

    provider_fns = {
        "pexels": _search_pexels,
        "coverr": _search_coverr,
        "pixabay": _search_pixabay,
    }

    results = []
    for i, provider in enumerate(providers):
        fn = provider_fns.get(provider)
        if not fn:
            continue
        # Give first `remainder` providers an extra clip
        alloc = per_provider + (1 if i < remainder else 0)
        provider_results = fn(query, alloc)
        log.info(
            "search_clips: provider=%s query='%s' requested=%d returned=%d",
            provider,
            query,
            alloc,
            len(provider_results),
        )
        results.extend(provider_results)

    # If we still don't have enough (some providers returned nothing),
    # backfill from the first provider that has extra capacity
    if len(results) < count:
        for provider in providers:
            if len(results) >= count:
                break
            fn = provider_fns.get(provider)
            if not fn:
                continue
            backfill = fn(query, count - len(results))
            # Avoid duplicates by source_asset_id
            existing_ids = {str(r.get("source_asset_id")) for r in results}
            for clip in backfill:
                if str(clip.get("source_asset_id")) not in existing_ids:
                    results.append(clip)
                    existing_ids.add(str(clip.get("source_asset_id")))
                if len(results) >= count:
                    break

    return results[:count]


async def async_search_clips(
    query: str, count: int = 5, provider_override: str = None
) -> list[dict]:
    return await asyncio.to_thread(search_clips, query, count, provider_override)


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
