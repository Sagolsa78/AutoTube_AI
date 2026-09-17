#!/usr/bin/env python3
"""Cheap preflight used before installing the full worker dependency set."""
from __future__ import annotations

import asyncio
import os
from urllib.parse import urlsplit

import asyncpg


def safe_db_info(url: str) -> str:
    p = urlsplit(url)
    host = p.hostname or "?"
    db = (p.path or "").lstrip("/") or "?"
    return f"host={host} db={db}"


async def main() -> None:
    job_id = os.getenv("JOB_ID", "").strip()
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not job_id:
        raise SystemExit("JOB_ID is missing")
    if not db_url:
        raise SystemExit("DATABASE_URL is missing in the GitHub Actions environment")

    print(f"[preflight] DATABASE_URL => {safe_db_info(db_url)}")
    conn = await asyncpg.connect(dsn=db_url, timeout=15)
    try:
        table = await conn.fetchval("SELECT to_regclass('public.jobs')::text")
        print(f"[preflight] public.jobs => {table or 'MISSING'}")
        if not table:
            raise SystemExit("public.jobs does not exist. GitHub Actions is pointing at the wrong database or schema.")

        found = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM public.jobs WHERE id::text = $1)", job_id
        )
        print(f"[preflight] job_id={job_id} visible={bool(found)}")
        if not found:
            raise SystemExit(
                "Job is not visible from GitHub Actions. Verify that DATABASE_URL is exactly the same database used by the deployed API and that the API committed the Job before dispatching the workflow."
            )
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
