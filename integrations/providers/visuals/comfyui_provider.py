"""
Client for local ComfyUI instance to generate images and videos.
Implements workflow-backed generation with configurable node IDs.
"""

import asyncio
import json
import logging
import os
import random
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Optional

from backend.core.config import settings
from backend.settings import BASE_DIR
from integrations.providers.base import VisualProvider

log = logging.getLogger(__name__)

COMFYUI_URL = settings.COMFYUI_URL
WORKFLOWS_DIR = Path(BASE_DIR) / "workflows" / "comfyui"

# Default node ID mappings loaded from manifest.json
MANIFEST_PATH = WORKFLOWS_DIR / "manifest.json"

# Timeout for generation in seconds
GENERATION_TIMEOUT = 300


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r") as f:
            return json.load(f)
    return {}


class ComfyWorkflow:
    """
    Reusable workflow adapter for ComfyUI.
    Loads, validates, and injects parameters into API-format workflows.
    """

    def __init__(self, workflow_name: str, node_ids: dict[str, str] | None = None):
        self.workflow_name = workflow_name
        self.manifest = load_manifest()

        manifest_data = self.manifest.get(workflow_name, {})
        self.node_ids = node_ids or manifest_data.get("inputs", {})
        self.workflow_filename = manifest_data.get("workflow", f"{workflow_name}.json")
        self.workflow_data: dict[str, Any] = {}
        self._loaded = False

    def load(self) -> "ComfyWorkflow":
        """Load workflow JSON from disk."""
        path = WORKFLOWS_DIR / self.workflow_filename
        if not path.exists():
            raise FileNotFoundError(f"ComfyUI workflow not found: {path}")

        with open(path, "r") as f:
            self.workflow_data = json.load(f)

        # Remove comment keys
        self.workflow_data.pop("_comment", None)
        self._loaded = True
        return self

    def validate(self) -> bool:
        """Validate that required node IDs exist in the workflow."""
        if not self._loaded:
            raise ValueError("Workflow not loaded. Call load() first.")

        for role, node_id in self.node_ids.items():
            if node_id not in self.workflow_data:
                log.warning(
                    f"Workflow '{self.workflow_name}' missing node '{node_id}' for role '{role}'"
                )
                return False
        return True

    def inject_prompt(self, prompt: str) -> "ComfyWorkflow":
        """Inject positive prompt text."""
        node_id = self.node_ids.get("positive_prompt")
        if node_id and node_id in self.workflow_data:
            self.workflow_data[node_id]["inputs"]["text"] = prompt
        return self

    def inject_negative_prompt(self, negative: str) -> "ComfyWorkflow":
        """Inject negative prompt text."""
        node_id = self.node_ids.get("negative_prompt")
        if node_id and node_id in self.workflow_data:
            self.workflow_data[node_id]["inputs"]["text"] = negative
        return self

    def inject_seed(self, seed: int | None = None) -> "ComfyWorkflow":
        """Inject random seed."""
        if seed is None:
            seed = random.randint(0, 2**32 - 1)
        node_id = self.node_ids.get("sampler")
        if node_id and node_id in self.workflow_data:
            self.workflow_data[node_id]["inputs"]["seed"] = seed
        self._seed = seed
        return self

    def inject_resolution(self, width: int, height: int) -> "ComfyWorkflow":
        """Inject output resolution."""
        node_id = self.node_ids.get("latent_image")
        if node_id and node_id in self.workflow_data:
            self.workflow_data[node_id]["inputs"]["width"] = width
            self.workflow_data[node_id]["inputs"]["height"] = height
        return self

    def inject_duration(self, duration: float) -> "ComfyWorkflow":
        """Inject video duration (for video workflows)."""
        node_id = self.node_ids.get("duration")
        if node_id and node_id in self.workflow_data:
            self.workflow_data[node_id]["inputs"]["duration"] = duration
        return self

    def get_prompt_data(self) -> dict:
        """Return the workflow data ready for ComfyUI queue."""
        return self.workflow_data


class ComfyUIProvider(VisualProvider):
    """Client for triggering workflows on a local ComfyUI server."""

    name = "comfyui"

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

    async def _queue_and_wait(
        self, prompt_workflow: dict, out_dir: str, timeout: int = GENERATION_TIMEOUT
    ) -> Optional[str]:
        """
        Queues a workflow to ComfyUI and polls for completion.
        Returns the path to the output file, or None if failed.
        """
        try:
            import websockets
        except ImportError:
            log.error("websockets package not installed — cannot connect to ComfyUI")
            return None

        client_id = str(uuid.uuid4())
        ws_url = (
            self.base_url.replace("http://", "ws://").replace("https://", "wss://")
            + f"/ws?clientId={client_id}"
        )

        try:
            async with websockets.connect(ws_url) as websocket:
                # 1. Queue prompt
                p = {"prompt": prompt_workflow, "client_id": client_id}
                data = json.dumps(p).encode("utf-8")
                req = urllib.request.Request(f"{self.base_url}/prompt", data=data)
                req.add_header("Content-Type", "application/json")

                try:
                    with urllib.request.urlopen(req, timeout=10) as response:
                        response_data = json.loads(response.read())
                        prompt_id = response_data["prompt_id"]
                except Exception as e:
                    log.error(f"Failed to queue ComfyUI prompt: {e}")
                    return None

                # 2. Listen for execution_success
                start_time = time.monotonic()
                while True:
                    if time.monotonic() - start_time > timeout:
                        log.error(f"ComfyUI generation timed out after {timeout}s")
                        return None

                    try:
                        out = await asyncio.wait_for(websocket.recv(), timeout=30)
                    except asyncio.TimeoutError:
                        continue

                    if isinstance(out, str):
                        message = json.loads(out)
                        if message["type"] == "executing":
                            data = message["data"]
                            if data["node"] is None and data["prompt_id"] == prompt_id:
                                break  # Execution is done
                        elif message["type"] == "execution_error":
                            log.error(
                                f"ComfyUI execution error: {message.get('data', {})}"
                            )
                            return None
        except Exception as e:
            log.error(f"ComfyUI websocket error: {e}")
            return None

        # 3. Fetch history to get output images/videos
        req = urllib.request.Request(f"{self.base_url}/history/{prompt_id}")
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                history = json.loads(response.read())
                history_data = history[prompt_id]

                # Look for outputs
                for node_id, node_output in history_data["outputs"].items():
                    # For images
                    if "images" in node_output:
                        for image in node_output["images"]:
                            filename = image["filename"]
                            subfolder = image["subfolder"]
                            folder_type = image["type"]

                            # Download it
                            url_values = urllib.parse.urlencode(
                                {
                                    "filename": filename,
                                    "subfolder": subfolder,
                                    "type": folder_type,
                                }
                            )
                            img_req = urllib.request.Request(
                                f"{self.base_url}/view?{url_values}"
                            )
                            os.makedirs(out_dir, exist_ok=True)
                            with urllib.request.urlopen(img_req) as img_res:
                                out_path = os.path.join(out_dir, filename)
                                with open(out_path, "wb") as f:
                                    f.write(img_res.read())
                                return out_path

                    # For videos (e.g. VideoCombine node)
                    elif "videos" in node_output or "gifs" in node_output:
                        vid_list = node_output.get(
                            "videos", node_output.get("gifs", [])
                        )
                        for vid in vid_list:
                            filename = vid["filename"]
                            subfolder = vid["subfolder"]
                            folder_type = vid["type"]

                            url_values = urllib.parse.urlencode(
                                {
                                    "filename": filename,
                                    "subfolder": subfolder,
                                    "type": folder_type,
                                }
                            )
                            vid_req = urllib.request.Request(
                                f"{self.base_url}/view?{url_values}"
                            )
                            os.makedirs(out_dir, exist_ok=True)
                            with urllib.request.urlopen(vid_req) as vid_res:
                                out_path = os.path.join(out_dir, filename)
                                with open(out_path, "wb") as f:
                                    f.write(vid_res.read())
                                return out_path

        except Exception as e:
            log.error(f"Failed to fetch ComfyUI history: {e}")

        return None

    async def generate_image(
        self,
        prompt: str,
        out_dir: str,
        orientation: str = "9:16",
        negative_prompt: str = "blurry, low quality, watermark, text, ugly, deformed",
        seed: int | None = None,
    ) -> Optional[str]:
        """Generates an image via ComfyUI with real workflow injection."""
        if not self.is_available():
            log.warning("ComfyUI not available for image generation.")
            return None

        log.info(f"Generating image with ComfyUI — prompt: {prompt[:80]}...")

        # Select workflow based on orientation
        workflow_name = "image_portrait" if orientation == "9:16" else "image_cinematic"

        try:
            workflow = ComfyWorkflow(workflow_name)
            workflow.load()

            if not workflow.validate():
                log.error(f"Workflow '{workflow_name}' failed validation")
                return None

            # Set resolution based on orientation
            if orientation == "9:16":
                width, height = 1080, 1920
            else:
                width, height = 1344, 768

            workflow.inject_prompt(prompt)
            workflow.inject_negative_prompt(negative_prompt)
            workflow.inject_seed(seed)
            workflow.inject_resolution(width, height)

            result = await self._queue_and_wait(workflow.get_prompt_data(), out_dir)

            if result:
                log.info(f"ComfyUI image generated: {result}")
                return result
            else:
                log.warning("ComfyUI image generation produced no output")
                return None

        except FileNotFoundError:
            log.warning(
                f"ComfyUI workflow '{workflow_name}' not found. "
                "Export your workflow in API format to workflows/comfyui/"
            )
            return None
        except Exception as e:
            log.error(f"ComfyUI image generation failed: {e}")
            return None

    async def generate_video(
        self,
        prompt: str,
        out_dir: str,
        orientation: str = "9:16",
        negative_prompt: str = "blurry, low quality, watermark, text",
        seed: int | None = None,
        duration: float = 3.0,
    ) -> Optional[str]:
        """
        Generates a video via ComfyUI.
        Requires a video_motion.json workflow to be present in workflows/comfyui/.
        Falls back gracefully if unavailable.
        """
        if not self.is_available():
            log.warning("ComfyUI not available for video generation.")
            return None

        log.info(f"Generating video with ComfyUI — prompt: {prompt[:80]}...")

        workflow_name = "video_motion"
        workflow_path = WORKFLOWS_DIR / f"{workflow_name}.json"

        if not workflow_path.exists():
            log.warning(
                f"ComfyUI video workflow '{workflow_name}.json' not found. "
                "Export your video workflow to workflows/comfyui/video_motion.json"
            )
            return None

        try:
            workflow = ComfyWorkflow(workflow_name)
            workflow.load()

            if not workflow.validate():
                log.error(f"Workflow '{workflow_name}' failed validation")
                return None

            workflow.inject_prompt(prompt)
            workflow.inject_negative_prompt(negative_prompt)
            workflow.inject_seed(seed)
            workflow.inject_duration(duration)

            result = await self._queue_and_wait(
                workflow.get_prompt_data(), out_dir, timeout=600
            )

            if result:
                log.info(f"ComfyUI video generated: {result}")
                return result
            else:
                log.warning("ComfyUI video generation produced no output")
                return None

        except Exception as e:
            log.error(f"ComfyUI video generation failed: {e}")
            return None
