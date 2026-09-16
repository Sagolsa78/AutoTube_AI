import os
import re


def replace_in_file(filepath, pattern, replacement):
    with open(filepath, "r") as f:
        content = f.read()

    new_content = re.sub(pattern, replacement, content)

    with open(filepath, "w") as f:
        f.write(new_content)


def main():
    # 1. videos.py
    videos_path = "backend/api/routes/videos.py"
    # For user-facing endpoints in videos.py (v = await db.get(Video, video_id))
    replace_in_file(
        videos_path,
        r"v = await db\.get\(Video, video_id\)\n\s*if not v or v\.user_id != user\.id:",
        r"v = await db.scalar(select(Video).where(Video.id == video_id, Video.user_id == user.id))\n    if not v:",
    )
    # Publication query in videos.py
    replace_in_file(
        videos_path,
        r"pub_q = select\(Publication\)\.where\(Publication\.video_id == video_id\)",
        r"pub_q = select(Publication).where(Publication.video_id == video_id, Publication.user_id == user.id)",
    )

    # 2. scripts.py
    scripts_path = "backend/api/routes/scripts.py"
    replace_in_file(
        scripts_path,
        r"idea = await db\.get\(Idea, idea_id\)\n\s*if not idea or idea\.user_id != user_id_val:",
        r"idea = await db.scalar(select(Idea).where(Idea.id == idea_id, Idea.user_id == user_id_val))\n    if not idea:",
    )
    replace_in_file(
        scripts_path,
        r"channel = await db\.get\(Channel, idea\.channel_id\)",
        r"channel = await db.scalar(select(Channel).where(Channel.id == idea.channel_id, Channel.user_id == user_id_val))",
    )
    replace_in_file(
        scripts_path,
        r"current_idea = await save_db\.get\(Idea, idea_id_val\)",
        r"current_idea = await save_db.scalar(select(Idea).where(Idea.id == idea_id_val, Idea.user_id == user.id))",
    )

    # 3. channels.py
    channels_path = "backend/api/routes/channels.py"
    replace_in_file(
        channels_path,
        r"channel = await db\.get\(Channel, channel_id\)\n\s*if not channel or channel\.user_id != user\.id:",
        r"channel = await db.scalar(select(Channel).where(Channel.id == channel_id, Channel.user_id == user.id))\n    if not channel:",
    )

    # 4. ideas.py
    ideas_path = "backend/api/routes/ideas.py"
    replace_in_file(
        ideas_path,
        r"channel = await db\.get\(Channel, body\.channel_id\)\n\s*if not channel or channel\.user_id != user\.id:",
        r"channel = await db.scalar(select(Channel).where(Channel.id == body.channel_id, Channel.user_id == user.id))\n    if not channel:",
    )
    replace_in_file(
        ideas_path,
        r"idea = await db\.get\(Idea, idea_id\)\n\s*if not idea:",
        r"idea = await db.scalar(select(Idea).where(Idea.id == idea_id, Idea.user_id == user.id))\n    if not idea:",
    )
    replace_in_file(
        ideas_path,
        r"channel = await db\.get\(Channel, idea\.channel_id\)",
        r"channel = await db.scalar(select(Channel).where(Channel.id == idea.channel_id, Channel.user_id == user.id))",
    )

    # 5. assets.py
    assets_path = "backend/api/routes/assets.py"
    replace_in_file(
        assets_path,
        r"scene = await db\.get\(Scene, scene_id\)\n\s*if not scene:",
        r"scene = await db.scalar(select(Scene).where(Scene.id == scene_id, Scene.user_id == user.id))\n    if not scene:",
    )
    replace_in_file(
        assets_path,
        r'q = select\(Asset\)\.where\(\n\s*Asset\.source == asset_data\.get\("source"\),\n\s*Asset\.source_asset_id == source_asset_id\n\s*\)',
        r'q = select(Asset).where(\n        Asset.source == asset_data.get("source"),\n        Asset.source_asset_id == source_asset_id,\n        Asset.user_id == user.id\n    )',
    )


if __name__ == "__main__":
    main()
