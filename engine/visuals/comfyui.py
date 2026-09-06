"""
Client for local ComfyUI instance to generate images and videos.
"""
import logging
import json
import urllib.request
import urllib.parse
from typing import Optional
import os
import uuid
from backend.settings import BASE_DIR

log = logging.getLogger(__name__)

COMFYUI_URL = os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")

class ComfyUIClient:
    """Client for triggering workflows on a local ComfyUI server."""
    
    def __init__(self, base_url: str = COMFYUI_URL):
        self.base_url = base_url

    def is_available(self) -> bool:
        """Check if ComfyUI is running and reachable."""
        try:
            req = urllib.request.Request(f"{self.base_url}/system_stats")
            with urllib.request.urlopen(req, timeout=2) as response:
                return response.status == 200
        except Exception:
            return False

    async def _queue_and_wait(self, prompt_workflow: dict, out_dir: str) -> Optional[str]:
        """
        Queues a workflow to ComfyUI and polls for completion.
        Requires `prompt_id` from the queue response.
        """
        import uuid
        import json
        import urllib.request
        import urllib.parse
        import time
        import os
        import websockets
        
        client_id = str(uuid.uuid4())
        
        # 1. Queue prompt
        p = {"prompt": prompt_workflow, "client_id": client_id}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"{self.base_url}/prompt", data=data)
        req.add_header('Content-Type', 'application/json')
        
        try:
            with urllib.request.urlopen(req) as response:
                response_data = json.loads(response.read())
                prompt_id = response_data['prompt_id']
        except Exception as e:
            log.error(f"Failed to queue ComfyUI prompt: {e}")
            return None
            
        # 2. Connect to websocket and listen for execution_success
        ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://") + f"/ws?clientId={client_id}"
        
        try:
            async with websockets.connect(ws_url) as websocket:
                while True:
                    out = await websocket.recv()
                    if isinstance(out, str):
                        message = json.loads(out)
                        if message['type'] == 'executing':
                            data = message['data']
                            if data['node'] is None and data['prompt_id'] == prompt_id:
                                break # Execution is done
        except Exception as e:
            log.error(f"ComfyUI websocket error: {e}")
            return None
            
        # 3. Fetch history to get output images/videos
        req = urllib.request.Request(f"{self.base_url}/history/{prompt_id}")
        try:
            with urllib.request.urlopen(req) as response:
                history = json.loads(response.read())
                history_data = history[prompt_id]
                
                # Look for outputs
                for node_id, node_output in history_data['outputs'].items():
                    # For images
                    if 'images' in node_output:
                        for image in node_output['images']:
                            filename = image['filename']
                            subfolder = image['subfolder']
                            folder_type = image['type']
                            
                            # Download it
                            url_values = urllib.parse.urlencode({'filename': filename, 'subfolder': subfolder, 'type': folder_type})
                            img_req = urllib.request.Request(f"{self.base_url}/view?{url_values}")
                            with urllib.request.urlopen(img_req) as img_res:
                                out_path = os.path.join(out_dir, filename)
                                with open(out_path, 'wb') as f:
                                    f.write(img_res.read())
                                return out_path
                                
                    # For videos (e.g. VideoCombine node)
                    elif 'videos' in node_output or 'gifs' in node_output:
                        vid_list = node_output.get('videos', node_output.get('gifs', []))
                        for vid in vid_list:
                            filename = vid['filename']
                            subfolder = vid['subfolder']
                            folder_type = vid['type']
                            
                            url_values = urllib.parse.urlencode({'filename': filename, 'subfolder': subfolder, 'type': folder_type})
                            vid_req = urllib.request.Request(f"{self.base_url}/view?{url_values}")
                            with urllib.request.urlopen(vid_req) as vid_res:
                                out_path = os.path.join(out_dir, filename)
                                with open(out_path, 'wb') as f:
                                    f.write(vid_res.read())
                                return out_path
                                
        except Exception as e:
            log.error(f"Failed to fetch ComfyUI history: {e}")
            
        return None

    async def generate_image(self, prompt: str, out_dir: str) -> Optional[str]:
        """Generates an image via ComfyUI."""
        if not self.is_available():
            log.warning("ComfyUI not available for image generation.")
            return None
            
        log.info(f"Generating image with prompt: {prompt}")
        # In a real setup, load SDXL workflow here and inject the prompt
        # workflow = json.loads(...)
        # workflow["3"]["inputs"]["text"] = prompt
        # return await self._queue_and_wait(workflow, out_dir)
        raise NotImplementedError("ComfyUI workflow injection not yet implemented.")

    async def generate_video(self, prompt: str, out_dir: str) -> Optional[str]:
        """Generates a video via ComfyUI (e.g. Wan2.2 or SVD)."""
        if not self.is_available():
            log.warning("ComfyUI not available for video generation.")
            return None
            
        log.info(f"Generating video with prompt: {prompt}")
        # workflow = json.loads(...)
        # workflow["6"]["inputs"]["text"] = prompt
        # return await self._queue_and_wait(workflow, out_dir)
        raise NotImplementedError("ComfyUI Wan2.2 workflow injection not yet implemented.")
