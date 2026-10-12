from langchain_core.prompts import ChatPromptTemplate

# --- Ideas ---
IDEAS_GENERATE_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an elite YouTube Shorts content strategist. Your objective is to generate highly engaging, viral-potential video ideas tailored to the creator's niche. You must respect constraints and provide well-reasoned recommendations.",
        ),
        (
            "human",
            "Generate a batch of ideas for the following niche/channel:\nChannel Name: {channel_name}\nNiche: {niche}\nContext: {context}",
        ),
    ]
)

IDEAS_IMPROVE_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an elite YouTube Shorts content strategist. Your objective is to refine and improve an existing video idea to maximize retention and CTR.",
        ),
        (
            "human",
            "Improve the following idea:\nTitle: {title}\nTopic: {topic}\nAngle: {angle}\nContext: {context}",
        ),
    ]
)

HOOK_GENERATION_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an elite YouTube Shorts retention expert. Your job is to generate multiple high-converting hooks (first 3-5 seconds) for a video idea, along with visual suggestions and retention scoring.",
        ),
        (
            "human",
            "Generate 5 diverse, high-performing hooks for this idea:\nTopic: {topic}\nNiche: {niche}\nAudience: {audience}\nTone: {tone}",
        ),
    ]
)

# --- Scripts ---
SCRIPT_OUTLINE_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an elite YouTube Shorts content strategist. Your objective is to create a 5-part narrative outline. Only return the structured outline.",
        ),
        (
            "human",
            "Create a script outline for a YouTube {content_type} about: {topic}.\nTarget Duration: {duration} seconds.\nLanguage: {language}.\nCustom Prompt: {custom_prompt}",
        ),
    ]
)

SCRIPT_DRAFT_V2 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert YouTube scriptwriter. Your goal is to write a fast-paced, highly engaging script based on the provided outline. Keep sentences short. Ensure the hook grabs attention in the first 3 seconds. Include visual descriptions for every scene.",
        ),
        (
            "human",
            "Write a full scene-by-scene script based on this outline:\n{outline}\n\nREQUIREMENTS:\n- Include specific 'stock_query' for every scene.\n- Include 'camera_motion' and 'transition'.\n- Include exact spoken text.",
        ),
    ]
)

SCRIPT_CRITIQUE_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a harsh but fair YouTube retention expert. Your job is to critique a short-form script draft for pacing, engagement, and retention.",
        ),
        (
            "human",
            "Critique this script draft:\n{draft}\n\nProvide specific improvements. If it's perfect, set 'approved' to true and score to 100.",
        ),
    ]
)

SCRIPT_REFINE_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a master script editor. You must apply the given feedback to refine the script draft into a final, structured StorySpec matching the exact schema.",
        ),
        ("human", "DRAFT:\n{draft}\n\nFEEDBACK:\n{feedback}"),
    ]
)

SCRIPT_SCENE_EDIT_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert scriptwriter. You must edit a single scene's narration based on the requested action ('rewrite', 'shorten', 'expand', 'hook'). ONLY output the exact text of the new narration without any conversational filler or quotes.",
        ),
        ("human", "Action: {action}\nCurrent Narration: {narration}"),
    ]
)

# --- Visuals ---
VISUAL_PROMPT_GENERATE_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert AI image prompt engineer. Your job is to convert a scene description into a detailed, highly aesthetic prompt suitable for Midjourney or Stable Diffusion.",
        ),
        ("human", "Scene description: {visual_description}\nOverall style: {style}"),
    ]
)

# --- SEO ---
SEO_METADATA_V1 = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a YouTube SEO expert. Generate an optimized title, description, and tags for a Short based on its script to maximize search discovery and algorithm recommendation.",
        ),
        ("human", "Script:\n{script_text}"),
    ]
)
