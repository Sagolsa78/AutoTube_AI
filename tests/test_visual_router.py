import pytest
from unittest.mock import AsyncMock, patch
from engine.visuals.router import VisualRouter

@pytest.fixture
def mock_router():
    return VisualRouter(visual_dir="/tmp/visuals")

@pytest.mark.asyncio
async def test_visual_router_auto_mode(mock_router):
    # Test that AUTO tries STOCK, then GENERATED_IMAGE, then GENERATED_VIDEO
    scene_data = {"preferred_visual_mode": "AUTO", "scene_number": 1}
    
    with patch.object(mock_router, '_resolve_stock', new_callable=AsyncMock) as mock_stock, \
         patch.object(mock_router, '_resolve_generated_image', new_callable=AsyncMock) as mock_image, \
         patch.object(mock_router, '_resolve_generated_video', new_callable=AsyncMock) as mock_video:
         
        # Scenario 1: Stock succeeds
        mock_stock.return_value = "/tmp/visuals/stock.mp4"
        res = await mock_router.resolve_asset(scene_data)
        assert res == "/tmp/visuals/stock.mp4"
        mock_stock.assert_called_once()
        mock_image.assert_not_called()
        
        # Scenario 2: Stock fails, Image succeeds
        mock_stock.reset_mock()
        mock_stock.return_value = None
        mock_image.return_value = "/tmp/visuals/gen.jpg"
        res = await mock_router.resolve_asset(scene_data)
        assert res == "/tmp/visuals/gen.jpg"
        mock_stock.assert_called_once()
        mock_image.assert_called_once()
        mock_video.assert_not_called()
        
        # Scenario 3: Stock fails, Image fails, Video succeeds
        mock_stock.reset_mock()
        mock_image.reset_mock()
        mock_stock.return_value = None
        mock_image.return_value = None
        mock_video.return_value = "/tmp/visuals/gen.mp4"
        res = await mock_router.resolve_asset(scene_data)
        assert res == "/tmp/visuals/gen.mp4"
        mock_stock.assert_called_once()
        mock_image.assert_called_once()
        mock_video.assert_called_once()

@pytest.mark.asyncio
@patch("engine.visuals.comfyui.ComfyUIClient")
async def test_visual_router_generation_prompt(mock_client_class, mock_router):
    # Test that generation_prompt takes precedence over visual_intent
    mock_client = mock_client_class.return_value
    mock_client.is_available.return_value = True
    mock_client.generate_image = AsyncMock(return_value="/tmp/visuals/gen.jpg")
    
    scene_data = {
        "preferred_visual_mode": "GENERATED_IMAGE",
        "scene_number": 1,
        "visual_description": "A description",
        "visual_intent": "An intent",
        "generation_prompt": "A very specific generation prompt"
    }
    
    with patch("engine.visuals.router.AsyncSessionLocal") as mock_db:
        mock_session = AsyncMock()
        mock_db.return_value.__aenter__.return_value = mock_session
        
        res = await mock_router.resolve_asset(scene_data, idea_topic="Topic")
        assert res == "/tmp/visuals/gen.jpg"
        mock_client.generate_image.assert_called_once_with("A very specific generation prompt", "/tmp/visuals")
