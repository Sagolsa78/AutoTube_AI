import pytest
from backend.api.routes.scripts import update_script, ScriptUpdateIn
from backend.models.models import Script, Scene, ScriptStatus
from unittest.mock import AsyncMock

class MockDB:
    def __init__(self, script):
        self.script = script
        self.flushed = False

    async def flush(self):
        self.flushed = True

    async def execute(self, stmt):
        outer_script = self.script
        class MockResult:
            def scalars(self):
                class MockScalars:
                    def first(self_mock):
                        return outer_script
                return MockScalars()
        return MockResult()


@pytest.mark.asyncio
async def test_update_script_saves_advanced_fields():
    # Setup initial script and scene
    scene = Scene(id="scene1", scene_number=1, narration="old narration", visual_description="old vis")
    script = Script(
        id="script1",
        status=ScriptStatus.draft,
        scenes=[scene],
        body={
            "scenes": [
                {"scene_number": 1, "preferred_visual_mode": "STOCK", "visual_intent": "old intent", "stock_query": "old query"}
            ]
        }
    )
    
    db = MockDB(script)
    
    # Payload simulating frontend update
    payload = ScriptUpdateIn(
        scenes=[
            {
                "id": "scene1",
                "narration": "new narration",
                "visual_description": "new vis",
                "preferred_visual_mode": "GENERATED_IMAGE",
                "generation_prompt": "new prompt",
                "visual_intent": "new intent",
                "stock_query": "new query"
            }
        ]
    )
    
    # Run API
    result = await update_script("script1", payload, db=db)
    
    # Assert Scene model updated
    assert scene.narration == "new narration"
    assert scene.visual_description == "new vis"
    
    # Assert JSON body updated
    updated_spec = script.body["scenes"][0]
    assert updated_spec["preferred_visual_mode"] == "GENERATED_IMAGE"
    assert updated_spec["generation_prompt"] == "new prompt"
    assert updated_spec["visual_intent"] == "new intent"
    assert updated_spec["stock_query"] == "new query"
    
    # Assert formatted result contains everything
    res_scene = result["scenes"][0]
    assert res_scene["narration"] == "new narration"
    assert res_scene["visual_description"] == "new vis"
    assert res_scene["preferred_visual_mode"] == "GENERATED_IMAGE"
    assert res_scene["generation_prompt"] == "new prompt"
    assert res_scene["visual_intent"] == "new intent"
    assert res_scene["stock_query"] == "new query"
