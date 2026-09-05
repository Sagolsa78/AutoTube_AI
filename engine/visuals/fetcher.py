"""
Visual fetcher — handles searching and downloading portrait stock clips from Pexels (primary)
then Pixabay (fallback).
"""
from __future__ import annotations
import logging
import os
import uuid
import asyncio
from pathlib import Path

import requests

from backend.settings import PEXELS_API_KEY, PIXABAY_API_KEY, VISUAL_DIR

log = logging.getLogger(__name__)


def search_clips(query: str, count: int = 5) -> list[dict]:
    """Search for clips on Pexels, then Pixabay, returning metadata without downloading."""
    results = []
    
    # 1. Pexels Search
    if PEXELS_API_KEY:
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
                # Prefer portrait HD
                files = sorted(
                    [f for f in video["video_files"] if f["height"] >= 720],
                    key=lambda f: f["height"],
                    reverse=True,
                )
                portrait = next((f for f in files if f["height"] > f["width"]), files[0] if files else None)
                if not portrait:
                    continue
                results.append({
                    "source": "pexels",
                    "source_asset_id": str(video.get("id", "")),
                    "thumbnail_url": video.get("image", ""),
                    "url": video.get("url", ""),
                    "download_url": portrait["link"],
                    "photographer": video.get("user", {}).get("name", ""),
                    "license": "Pexels License",
                    "commercial_ok": True,
                    "attribution_req": False,
                    "asset_metadata": video,
                })
        except Exception as exc:
            log.warning("Pexels search failed for '%s': %s", query, exc)

    # 2. Pixabay Search (Fallback or additive)
    if PIXABAY_API_KEY and len(results) < count:
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
                results.append({
                    "source": "pixabay",
                    "source_asset_id": str(hit.get("id", "")),
                    "thumbnail_url": f"https://i.vimeocdn.com/video/{hit.get('picture_id')}_640x360.jpg" if hit.get("picture_id") else "",
                    "url": hit.get("pageURL", ""),
                    "download_url": file_info["url"],
                    "photographer": hit.get("user", ""),
                    "license": "Pixabay Content License",
                    "commercial_ok": True,
                    "attribution_req": False,
                    "asset_metadata": hit,
                })
        except Exception as exc:
            log.warning("Pixabay search failed for '%s': %s", query, exc)
            
    return results[:count]


async def async_search_clips(query: str, count: int = 5) -> list[dict]:
    return await asyncio.to_thread(search_clips, query, count)


def chunk_download(url: str, dest: Path, chunk_size: int = 1 << 20):
    """Stream-download a file to avoid loading into memory."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=chunk_size):
                f.write(chunk)


async def async_download_clip(url: str, out_dir: str | Path, source: str = "asset") -> str:
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
            clip = clips[0] # Just take the top result
            try:
                local_path = await async_download_clip(clip["download_url"], target_dir, clip["source"])
                clip["path"] = local_path
                results.append(clip)
            except Exception as e:
                log.warning("Failed to download clip for query '%s': %s", query, e)
                
    return results
