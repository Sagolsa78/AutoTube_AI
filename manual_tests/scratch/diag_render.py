"""
Diagnostic: run _run_render directly in an asyncio event loop,
bypassing FastAPI BackgroundTasks entirely, to see what happens.
"""
import asyncio, sys, os
sys.path.insert(0, os.getcwd())

from backend.db.database import AsyncSessionLocal
from backend.models.models import Video, Script, Idea, Channel
from engine.models import RenderJob
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # Get the latest rendering video
        result = await db.execute(
            select(Video).where(Video.status == "rendering").limit(1)
        )
        video = result.scalars().first()
        if not video:
            print("No rendering video found")
            return
        
        print(f"Found video: {video.id}, script_id={video.script_id}")
        
        script = await db.get(Script, video.script_id)
        if not script:
            print("Script not found")
            return
        
        print(f"Script full_text: {script.full_text[:80]}...")
        print(f"Script visual_prompts: {script.visual_prompts}")
        
        idea = await db.get(Idea, script.idea_id) if script else None
        channel = await db.get(Channel, idea.channel_id) if idea else None
        niche = channel.niche if channel else "science_wow"
        
        job = RenderJob(
            video_id=video.id,
            script_full_text=script.full_text,
            niche=niche,
            caption_style=video.caption_style or "bold_centered",
            style=video.style or "fast_facts",
        )
        
        # TTS step
        print(">>> Starting TTS...")
        from engine.tts.voiceover import generate_voiceover
        audio_dir = f"storage/audio/{video.id}"
        os.makedirs(audio_dir, exist_ok=True)
        try:
            tts = await generate_voiceover(
                job.script_full_text, niche=job.niche,
                audio_path=f"{audio_dir}/voice.mp3",
                sub_path=f"{audio_dir}/subs.ass",
            )
            print(f"TTS done: {tts['audio_path']}, duration={tts['duration']}")
        except Exception as e:
            print(f"TTS FAILED: {e}")
            import traceback; traceback.print_exc()
            return
        
        print(">>> SUCCESS - TTS step completed")

asyncio.run(main())
