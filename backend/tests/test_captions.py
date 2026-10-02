import os
import tempfile

import pytest

from engine.captions.styles import build_karaoke_ass


def test_malicious_subtitle_text():
    """Phase 22: Ensure ASS generation escapes malicious override tags."""
    boundaries = [
        {"text": "Hello{\\pos(0,0)}", "offset": 0.0, "duration": 1.0},
        {"text": "world\\N", "offset": 1.0, "duration": 1.0},
        {"text": "\x00bad", "offset": 2.0, "duration": 1.0},
    ]
    with tempfile.TemporaryDirectory() as td:
        out_path = os.path.join(td, "test.ass")
        build_karaoke_ass(boundaries, out_path)
        content = open(out_path).read()

        # Ensure { and } are escaped
        assert "{\\pos" not in content
        assert "Hello｛＼pos(0,0)｝" in content

        # Ensure backslashes are escaped
        assert "world＼N" in content

        # Ensure control characters are stripped
        assert "\x00bad" not in content
        assert "bad" in content
