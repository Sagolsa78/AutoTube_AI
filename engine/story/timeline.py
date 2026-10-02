from pydantic import BaseModel, Field
from typing import List, Optional

class TimelineScene(BaseModel):
    scene_id: str
    scene_number: int
    start: float
    end: float
    duration: float
    asset_id: Optional[str] = None
    asset_path: Optional[str] = None
    crop: str = "1080:1920"
    transition: str = "fade"
    motion: str = "none"
    effects: List[str] = Field(default_factory=list)

class RenderTimeline(BaseModel):
    audio_track: str
    scenes: List[TimelineScene] = Field(default_factory=list)
    captions: str = ""
    music: Optional[str] = None
    sfx: List[str] = Field(default_factory=list)
    transitions: bool = True
    branding: Optional[str] = None

from engine.story.schemas import StorySpec

def align_scenes_to_audio(story_spec: StorySpec, word_boundaries: list[dict], audio_path: str, sub_path: str) -> RenderTimeline:
    """
    Aligns scenes to exact audio timestamps based on TTS word boundaries.
    Returns a RenderTimeline.
    """
    timeline = RenderTimeline(
        audio_track=audio_path,
        captions=sub_path
    )
    
    if not word_boundaries or not story_spec.scenes:
        return timeline
        
    # We will match words to scenes by walking both lists.
    # A robust way is to join the words for each scene and match them, but since
    # TTS word boundaries come sequentially, we can track the word index.
    
    word_idx = 0
    total_words = len(word_boundaries)
    
    import re
    
    def normalize(text):
        return re.sub(r'[^a-zA-Z0-9]', '', text).lower()
        
    for scene in sorted(story_spec.scenes, key=lambda x: x.scene_number):
        narration = scene.narration or ""
        if not narration.strip():
            # Empty scene gets minimal duration if it's the last one? 
            # We'll skip or give it 0 duration for now.
            continue
            
        scene_words = [normalize(w) for w in narration.split() if normalize(w)]
        if not scene_words:
            continue
            
        # The scene starts at the current word_idx offset
        if word_idx < total_words:
            start_time = word_boundaries[word_idx]["offset"]
        else:
            start_time = word_boundaries[-1]["offset"] + word_boundaries[-1]["duration"]
            
        # Advance word_idx by the number of words in this scene
        # A more robust alignment would do dynamic programming or fuzzy matching,
        # but since TTS reads exactly what we gave it, counting words should generally work.
        words_to_match = len(scene_words)
        
        # Edge-TTS sometimes splits words differently (e.g. hyphens, numbers).
        # We'll consume boundaries until we've roughly matched the scene text.
        # Simple heuristic: consume boundaries until the concatenated boundaries 
        # match the scene words text length or we consume `words_to_match` boundaries.
        consumed = 0
        end_time = start_time
        
        target_text = "".join(scene_words)
        matched_text = ""
        
        while word_idx < total_words and len(matched_text) < len(target_text) * 0.8:
            wb = word_boundaries[word_idx]
            matched_text += normalize(wb["text"])
            end_time = wb["offset"] + wb["duration"]
            word_idx += 1
            consumed += 1
            if consumed >= words_to_match * 2: # Fail-safe
                break
                
        # If it's the last scene, just stretch it to the end of the audio track
        if scene == story_spec.scenes[-1] and word_boundaries:
            end_time = word_boundaries[-1]["offset"] + word_boundaries[-1]["duration"]
            
        timeline.scenes.append(TimelineScene(
            scene_id=scene.scene_id or str(scene.scene_number),
            scene_number=scene.scene_number,
            start=start_time,
            end=end_time,
            duration=end_time - start_time,
            asset_id=scene.asset_id
        ))
        
    return timeline
