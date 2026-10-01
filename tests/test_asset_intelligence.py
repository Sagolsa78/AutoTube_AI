from unittest.mock import MagicMock, patch

import pytest

from backend.models.models import Asset, User
from engine.visuals.intelligence import AssetIntelligenceEngine


class AsyncMock(MagicMock):
    async def __call__(self, *args, **kwargs):
        return super(AsyncMock, self).__call__(*args, **kwargs)


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Mock the execute/scalar response for used assets
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = ["used_id_1"]
    session.execute.return_value = mock_res

    # Mock user fetch
    mock_user = User(
        id="user_1", preferred_ai_provider="openai", preferred_ai_model="gpt-4"
    )
    session.get.return_value = mock_user
    return session


@pytest.mark.asyncio
@patch("engine.visuals.intelligence.generate_with_fallback", new_callable=AsyncMock)
async def test_rank_candidates(mock_generate, mock_db_session):
    # Mock LLM returning selected_id
    mock_generate.return_value = ('{"selected_id": "best_id_3"}', "openai")

    candidates = [
        {
            "source_asset_id": "used_id_1",
            "duration": 5.0,
            "width": 1080,
            "height": 1920,
            "photographer": "Alice",
        },
        {
            "source_asset_id": "short_id_2",
            "duration": 2.0,  # Too short
            "width": 1080,
            "height": 1920,
            "photographer": "Bob",
        },
        {
            "source_asset_id": "best_id_3",
            "duration": 6.0,
            "width": 1080,
            "height": 1920,
            "photographer": "Charlie",
            "asset_metadata": {"tags": "amazing ocean storm"},
        },
        {
            "source_asset_id": "landscape_id_4",
            "duration": 6.0,
            "width": 1920,  # Landscape
            "height": 1080,
            "photographer": "Dave",
        },
    ]

    ranked = await AssetIntelligenceEngine.rank_candidates(
        candidates,
        user_id="user_1",
        scene_intent="A stormy ocean",
        db=mock_db_session,
        min_duration=3.0,
    )

    # best_id_3 should be first (semantic match +1000)
    assert ranked[0]["source_asset_id"] == "best_id_3"

    # We should have penalized the used one heavily
    used_candidate = next(c for c in ranked if c["source_asset_id"] == "used_id_1")
    assert used_candidate["_intelligence_score"] < 100

    # We should have penalized the short one
    short_candidate = next(c for c in ranked if c["source_asset_id"] == "short_id_2")
    assert short_candidate["_intelligence_score"] < 100

    # We should have penalized the landscape one
    landscape_candidate = next(
        c for c in ranked if c["source_asset_id"] == "landscape_id_4"
    )
    assert landscape_candidate["_intelligence_score"] < 100
