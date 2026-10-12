import logging
from typing import Any, Dict, Type, TypeVar

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from backend.ai.providers.registry import get_model

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


async def generate_structured(
    operation: str,
    prompt_template: ChatPromptTemplate,
    schema: Type[T],
    context: Dict[str, Any],
    policy: str = "fast",
) -> tuple[T, Dict[str, Any]]:
    """
    Core AI gateway function.
    Given a prompt template and a Pydantic schema, it fetches the appropriate model,
    enforces structured output, and invokes the chain asynchronously.
    Returns (parsed_object, metadata_dict).
    """
    model = get_model(policy_type=policy)

    # Enable structured output using the passed schema and include raw response for metadata
    structured_model = model.with_structured_output(schema, include_raw=True)

    # Construct the LangChain
    chain = prompt_template | structured_model

    log.info(
        f"AI Gateway: Executing '{operation}' via {model.__class__.__name__} (Policy: {policy})"
    )

    try:
        # Execute the chain
        result = await chain.ainvoke(context)

        parsed = result.get("parsed")
        raw_msg = result.get("raw")

        metadata = {}
        if raw_msg:
            metadata = raw_msg.response_metadata or {}

        # Extract provider/model details
        meta_out = {
            "provider": getattr(model, "_llm_type", "unknown"),
            "model": getattr(model, "model", "unknown"),
            "usage": metadata.get("token_usage", metadata.get("usage", {})),
            "raw_metadata": metadata,
        }

        if isinstance(parsed, dict):
            return schema(**parsed), meta_out

        return parsed, meta_out
    except Exception as e:
        log.error(f"AI Gateway error during '{operation}': {str(e)}")
        raise e
