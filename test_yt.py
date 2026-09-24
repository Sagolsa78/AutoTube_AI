import os
import sys

sys.path.append("/mnt/Drive_01/AutoTube_Ai")

from backend.api.routes.youtube import get_oauth_flow

try:
    flow = get_oauth_flow("http://localhost:8000/api/youtube/callback")
    print(flow.authorization_url(access_type="offline", prompt="consent"))
except Exception as e:
    import traceback

    traceback.print_exc()
