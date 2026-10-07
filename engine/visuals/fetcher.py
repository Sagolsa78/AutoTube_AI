"""
Visual fetcher — handles searching and downloading portrait stock clips from Pexels (primary)
then Pixabay (fallback) using async httpx.
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import uuid
from pathlib import Path

import httpx

from backend.core.config import settings
from backend.settings import PEXELS_API_KEY, PIXABAY_API_KEY, VISUAL_DIR

log = logging.getLogger(__name__)


async def _search_coverr(
    client: httpx.AsyncClient, query: str, count: int
) -> list[dict]:
    results = []
    if not settings.COVERR_ENABLED:
        return results

    try:
        headers = {}
        params = {"query": query, "urls": "true", "page_size": count}
        if settings.COVERR_API_KEY:
            headers["Authorization"] = f"Bearer {settings.COVERR_API_KEY}"

        resp = await client.get(
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


async def _search_pexels(
    client: httpx.AsyncClient, query: str, count: int, orientation: str = "portrait"
) -> list[dict]:
    results = []
    if not PEXELS_API_KEY:
        return results

    headers = {"Authorization": PEXELS_API_KEY}
    try:
        resp = await client.get(
            "https://api.pexels.com/videos/search",
            params={"query": query, "per_page": count, "orientation": orientation},
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        for video in resp.json().get("videos", []):
            files = sorted(
                [
                    f
                    for f in video["video_files"]
                    if f["height"] >= 720 or f["width"] >= 720
                ],
                key=lambda f: f["height"] if orientation == "portrait" else f["width"],
                reverse=True,
            )
            selected_file = next(
                (
                    f
                    for f in files
                    if (
                        f["height"] > f["width"]
                        if orientation == "portrait"
                        else f["width"] > f["height"]
                    )
                ),
                files[0] if files else None,
            )
            if not selected_file:
                continue
            results.append(
                {
                    "source": "pexels",
                    "source_asset_id": str(video.get("id", "")),
                    "thumbnail_url": video.get("image", ""),
                    "url": video.get("url", ""),
                    "download_url": selected_file["link"],
                    "duration": video.get("duration", 0),
                    "width": selected_file.get("width", 0),
                    "height": selected_file.get("height", 0),
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


async def _search_pixabay(
    client: httpx.AsyncClient, query: str, count: int
) -> list[dict]:
    results = []
    if not PIXABAY_API_KEY:
        return results

    try:
        resp = await client.get(
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


async def search_clips(
    query: str,
    count: int = 5,
    provider_override: str = None,
    orientation: str = "portrait",
) -> list[dict]:
    if provider_override:
        providers = [provider_override]
    else:
        providers = settings.parsed_stock_provider_order

    if not providers:
        return []

    per_provider = max(1, count // len(providers))
    remainder = count % len(providers)

    provider_fns = {
        "pexels": _search_pexels,
        "coverr": _search_coverr,
        "pixabay": _search_pixabay,
    }

    results = []
    async with httpx.AsyncClient() as client:
        for i, provider in enumerate(providers):
            fn = provider_fns.get(provider)
            if not fn:
                continue
            alloc = per_provider + (1 if i < remainder else 0)
            if provider == "pexels":
                provider_results = await fn(client, query, alloc, orientation)
            else:
                provider_results = await fn(client, query, alloc)

            log.info(
                "search_clips: provider=%s query='%s' requested=%d returned=%d",
                provider,
                query,
                alloc,
                len(provider_results),
            )
            results.extend(provider_results)

        if len(results) < count:
            for provider in providers:
                if len(results) >= count:
                    break
                fn = provider_fns.get(provider)
                if not fn:
                    continue
                if provider == "pexels":
                    backfill = await fn(
                        client, query, count - len(results), orientation
                    )
                else:
                    backfill = await fn(client, query, count - len(results))
                existing_ids = {str(r.get("source_asset_id")) for r in results}
                for clip in backfill:
                    if str(clip.get("source_asset_id")) not in existing_ids:
                        results.append(clip)
                        existing_ids.add(str(clip.get("source_asset_id")))
                    if len(results) >= count:
                        break

    return results[:count]


async def async_search_clips(
    query: str,
    count: int = 5,
    provider_override: str = None,
    orientation: str = "portrait",
) -> list[dict]:
    # Alias to not break backward compatibility with code expecting an async wrapper
    return await search_clips(query, count, provider_override, orientation)


async def chunk_download(url: str, dest: Path, chunk_size: int = 1 << 20):
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_dest = dest.with_suffix(".tmp")

    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
                async with client.stream("GET", url) as r:
                    r.raise_for_status()
                    # Open file synchronously since aiofiles isn't guaranteed
                    with open(tmp_dest, "wb") as f:
                        async for chunk in r.aiter_bytes(chunk_size=chunk_size):
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

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                raise ValueError(f"ffprobe failed: {stderr.decode()}")

            out = stdout.decode().strip()
            if not out or float(out) <= 0:
                raise ValueError(f"Invalid media duration: {out}")

            tmp_dest.rename(dest)
            return
        except Exception as e:
            if tmp_dest.exists():
                tmp_dest.unlink()
            if attempt == max_retries - 1:
                raise RuntimeError(f"Download failed after {max_retries} attempts: {e}")
            await asyncio.sleep(2 * (attempt + 1))


async def async_download_clip(
    url: str, out_dir: str | Path, source: str = "asset"
) -> str:
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    clip_path = out_path / f"{source}_{uuid.uuid4().hex[:8]}.mp4"
    await chunk_download(url, clip_path)
    return str(clip_path)


async def async_fetch_clips(
    queries: list[str],
    clips_per_query: int = 1,
    out_dir: str | None = None,
) -> list[dict]:
    target_dir = out_dir if out_dir else VISUAL_DIR
    results = []

    for query in queries:
        clips = await async_search_clips(query, count=clips_per_query)
        if clips:
            clip = clips[0]
            try:
                local_path = await async_download_clip(
                    clip["download_url"], target_dir, clip["source"]
                )
                clip["path"] = local_path
                results.append(clip)
            except Exception as e:
                log.warning("Failed to download clip for query '%s': %s", query, e)

    return results
