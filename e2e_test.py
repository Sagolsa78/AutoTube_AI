import asyncio
import logging
import os
import sys
import uuid

from sqlalchemy import select

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from backend.api.routes.scripts import generate_script_for_idea
from backend.api.routes.videos import render_video
from backend.db.database import AsyncSessionLocal, init_db
from backend.models.models import Channel, Idea, Script, User, Video, VideoStatus
from engine.script.hook_generator import generate_hooks

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("e2e_test")


async def run_e2e():
    log.info("Starting E2E Validation...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # 1. Create Mock User & Channel
        user_id = str(uuid.uuid4())
        mock_user = User(id=user_id, email=f"e2e_test_{user_id[:8]}@example.com")
        db.add(mock_user)

        channel_id = str(uuid.uuid4())
        mock_channel = Channel(
            id=channel_id,
            user_id=user_id,
            name="E2E Science",
            niche="Astrophysics",
            content_tone="Educational",
            target_audience="Science enthusiasts",
        )
        db.add(mock_channel)
        await db.commit()
        log.info(f"Created Mock User ({user_id}) and Channel ({channel_id})")

        # 2. Create Idea
        topic = "The Fermi Paradox Explained"
        idea_id = str(uuid.uuid4())
        idea = Idea(
            id=idea_id,
            user_id=user_id,
            channel_id=channel_id,
            title=topic,
            topic=topic,
            status="pending",
        )
        db.add(idea)
        await db.commit()
        log.info(f"Created Idea: {topic}")

        # 3. Test Hook Engine
        log.info("Testing Hook Engine...")
        hooks = await generate_hooks(
            topic=topic,
            niche=mock_channel.niche,
            target_audience=mock_channel.target_audience,
            tone=mock_channel.content_tone,
            provider="gemini",
            model="gemini-1.5-pro",
        )
        if not hooks or len(hooks.candidates) == 0:
            log.error("Hook engine returned no candidates!")
            return

        best_hook = hooks.candidates[hooks.best_hook_index]
        log.info(f"Hook Engine OK. Best hook [{best_hook.hook_type}]: {best_hook.text}")

        # Promote idea so script can generate
        idea.status = "promoted"
        idea.settings = {
            "hooks": [h.model_dump() for h in hooks.candidates],
            "best_hook_index": hooks.best_hook_index,
            "custom_prompt": f"Start with this hook: {best_hook.text}",
        }
        await db.commit()

        # 4. Generate Script
        log.info("Generating Script...")
        # We call the router function directly, but we need to pass db and user
        # Note: the router function handles its own commit/flush logic, so we pass our session
        try:
            script_out = await generate_script_for_idea(
                idea_id=idea_id, user=mock_user, db=db
            )
            script_id = script_out["id"]
            log.info(
                f"Script Generated OK: {script_id} with {len(script_out['scenes'])} scenes."
            )
        except Exception as e:
            log.error(f"Script generation failed: {e}")
            return

        # 5. Test Video Queueing
        log.info("Dispatching Video Render Job...")
        try:
            from backend.api.routes.videos import RenderIn

            vid_out = await render_video(
                body=RenderIn(
                    script_id=script_id,
                    style="fast_facts",
                    content_type="short",
                    orientation="9:16",
                    visual_strategy="auto",
                    duration_mode="auto",
                ),
                user=mock_user,
                db=db,
            )
            log.info(f"Video Job queued OK: {vid_out['id']}")

            # Verify it's in the DB
            q = select(Video).where(Video.id == vid_out["id"])
            res = await db.execute(q)
            vid = res.scalars().first()
            if vid and vid.status == VideoStatus.rendering:
                log.info("✅ FULL E2E WORKFLOW VALIDATED SUCESSFULLY.")
            else:
                log.error("Video status is not 'rendering'!")
        except Exception as e:
            log.error(f"Video job dispatch failed: {e}")


if __name__ == "__main__":
    asyncio.run(run_e2e())
