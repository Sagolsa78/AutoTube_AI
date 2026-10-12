import logging

from backend.ai.gateway.llm_gateway import generate_structured
from backend.ai.prompts.prompts import HOOK_GENERATION_V1
from backend.ai.schemas.schemas import HookBatch

log = logging.getLogger(__name__)


async def generate_hooks(
    topic: str,
    niche: str,
    target_audience: str,
    tone: str,
    provider: str = None,
    model: str = None,
) -> HookBatch:
    """
    Generates alternative viral hooks for a given idea/topic using the LLM Gateway.
    """
    log.info(f"Generating hooks for topic: {topic}")

    batch, metadata = await generate_structured(
        operation="generate_hooks",
        prompt_template=HOOK_GENERATION_V1,
        schema=HookBatch,
        context={
            "topic": topic,
            "niche": niche,
            "audience": target_audience,
            "tone": tone,
        },
        policy="reasoning",
    )

    return batch
