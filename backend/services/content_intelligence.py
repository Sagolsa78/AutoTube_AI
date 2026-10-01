"""
Content Intelligence Service — Phase 2.
Uses channel history and performance data to generate content signals
and recommend next video topics.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.models import (
    Analytics,
    Channel,
    Idea,
    IdeaStatus,
    Script,
    Video,
    VideoStatus,
)
from integrations.providers.ai_providers import generate_with_fallback

log = logging.getLogger(__name__)


class ContentSignal:
    """Structured content signal for a topic cluster."""

    def __init__(
        self,
        topic_cluster: str = "",
        performance_signal: str = "neutral",
        recency: float = 0.0,
        novelty: float = 1.0,
        hook_strength: float = 0.5,
        visual_feasibility: float = 0.7,
        relevance: float = 0.5,
    ):
        self.topic_cluster = topic_cluster
        self.performance_signal = performance_signal
        self.recency = recency
        self.novelty = novelty
        self.hook_strength = hook_strength
        self.visual_feasibility = visual_feasibility
        self.relevance = relevance

    def to_dict(self) -> dict:
        return {
            "topic_cluster": self.topic_cluster,
            "performance_signal": self.performance_signal,
            "recency": round(self.recency, 3),
            "novelty": round(self.novelty, 3),
            "hook_strength": round(self.hook_strength, 3),
            "visual_feasibility": round(self.visual_feasibility, 3),
            "relevance": round(self.relevance, 3),
        }


class ContentIntelligenceService:
    """
    Analyzes channel history and produces content recommendations.
    Does NOT blindly optimize for views alone — uses multi-signal approach.
    """

    @classmethod
    async def get_channel_context(
        cls, channel_id: str, user_id: str, db: AsyncSession
    ) -> dict[str, Any]:
        """Gather channel configuration and recent history for idea generation."""
        channel = await db.get(Channel, channel_id)
        if not channel or channel.user_id != user_id:
            return {}

        # Get recent ideas (last 50)
        ideas_q = (
            select(Idea)
            .where(Idea.channel_id == channel_id, Idea.user_id == user_id)
            .order_by(desc(Idea.created_at))
            .limit(50)
        )
        ideas_res = await db.execute(ideas_q)
        recent_ideas = ideas_res.scalars().all()

        # Get recent videos with analytics
        videos_q = (
            select(Video)
            .join(Script, Video.script_id == Script.id)
            .join(Idea, Script.idea_id == Idea.id)
            .where(Idea.channel_id == channel_id, Video.user_id == user_id)
            .order_by(desc(Video.created_at))
            .limit(20)
        )
        videos_res = await db.execute(videos_q)
        recent_videos = videos_res.scalars().all()

        # Gather analytics for those videos
        video_ids = [v.id for v in recent_videos]
        analytics_data = {}
        if video_ids:
            analytics_q = select(Analytics).where(Analytics.video_id.in_(video_ids))
            analytics_res = await db.execute(analytics_q)
            for a in analytics_res.scalars().all():
                analytics_data[a.video_id] = {
                    "views": a.views or 0,
                    "likes": a.likes or 0,
                    "comments": a.comments or 0,
                    "retention": a.retention,
                }

        return {
            "channel": {
                "name": channel.name,
                "niche": channel.niche,
                "language": channel.language,
                "content_pillars": channel.content_pillars or [],
                "target_audience": channel.target_audience or "",
                "excluded_topics": channel.excluded_topics or [],
                "excluded_keywords": channel.excluded_keywords or [],
                "content_tone": channel.content_tone or "casual",
                "title_style_preference": channel.title_style_preference or "curiosity",
                "preferred_content_formats": channel.preferred_content_formats
                or ["short"],
            },
            "recent_titles": [i.title for i in recent_ideas],
            "recent_topics": [i.topic for i in recent_ideas],
            "promoted_topics": [
                i.topic for i in recent_ideas if i.status == IdeaStatus.promoted
            ],
            "video_performance": {
                v.id: {
                    "title": v.selected_title,
                    "duration": v.duration,
                    "status": (
                        v.status.value if hasattr(v.status, "value") else v.status
                    ),
                    "analytics": analytics_data.get(v.id, {}),
                }
                for v in recent_videos
            },
        }

    @classmethod
    async def generate_content_signal(
        cls, channel_id: str, user_id: str, db: AsyncSession
    ) -> list[ContentSignal]:
        """
        Analyze channel history and generate structured content signals.
        Groups recent content into topic clusters with performance data.
        """
        context = await cls.get_channel_context(channel_id, user_id, db)
        if not context:
            return []

        signals = []
        # Group topics by similarity (simplified — uses keyword overlap)
        topic_groups: dict[str, list[str]] = {}
        for topic in context.get("recent_topics", []):
            words = set(topic.lower().split())
            matched = False
            for cluster_key, members in topic_groups.items():
                cluster_words = set(cluster_key.lower().split())
                if len(words & cluster_words) >= 1:
                    members.append(topic)
                    matched = True
                    break
            if not matched:
                topic_groups[topic] = [topic]

        recent_titles = set(context.get("recent_titles", []))
        excluded = set(t.lower() for t in context["channel"].get("excluded_topics", []))

        for cluster_key, members in topic_groups.items():
            # Check exclusion
            if any(ex in cluster_key.lower() for ex in excluded):
                continue

            novelty = max(0.0, 1.0 - (len(members) / 10.0))
            recency = min(1.0, len(members) / 5.0)

            signal = ContentSignal(
                topic_cluster=cluster_key,
                performance_signal="strong" if len(members) >= 3 else "neutral",
                recency=recency,
                novelty=novelty,
                hook_strength=0.6,
                visual_feasibility=0.7,
                relevance=0.8 if context["channel"].get("content_pillars") else 0.5,
            )
            signals.append(signal)

        return signals

    @classmethod
    async def recommend_next(
        cls,
        channel_id: str,
        user_id: str,
        db: AsyncSession,
        preferred_provider: str = "gemini",
        preferred_model: str = "gemini-3.5-flash-lite",
    ) -> dict[str, Any]:
        """
        Generate a recommended next video topic using channel intelligence.
        Returns structured recommendation with reasoning.
        """
        context = await cls.get_channel_context(channel_id, user_id, db)
        if not context:
            return {"error": "Channel not found or no context available"}

        channel_info = context["channel"]
        recent_titles = context.get("recent_titles", [])[:15]
        excluded = channel_info.get("excluded_topics", [])
        pillars = channel_info.get("content_pillars", [])

        prompt = f"""You are an expert YouTube content strategist.

Channel: "{channel_info['name']}"
Niche: {channel_info['niche']}
Language: {channel_info['language']}
Content Pillars: {json.dumps(pillars) if pillars else 'Not specified'}
Target Audience: {channel_info.get('target_audience', 'General')}
Tone: {channel_info.get('content_tone', 'casual')}
Title Style: {channel_info.get('title_style_preference', 'curiosity')}

Recent Titles (avoid duplicating):
{json.dumps(recent_titles[:10])}

Excluded Topics: {json.dumps(excluded) if excluded else 'None'}

Generate ONE highly specific video recommendation. Use this structure:
- Topic must match the niche and content pillars
- Must NOT duplicate any recent title
- Must NOT match any excluded topic
- Must have a strong curiosity hook
- Must be visually feasible with stock footage
- Suggest an appropriate duration

Respond ONLY with this JSON (no markdown, no extra text):
{{
  "recommended_topic": "A specific, hook-driven topic title",
  "alternative_topics": ["Alternative 1", "Alternative 2"],
  "reason": "Why this topic is strong for this channel right now",
  "suggested_duration_seconds": 45,
  "suggested_format": "short",
  "visual_strategy": "stock_first",
  "recent_content_overlap": "low",
  "confidence": 0.85
}}"""

        try:
            import asyncio

            raw_response, provider_used = await asyncio.to_thread(
                generate_with_fallback,
                prompt,
                preferred_provider=preferred_provider,
                preferred_model=preferred_model,
            )
            cleaned = raw_response.replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned)

            # Validate: filter out any excluded topics
            if excluded:
                rec_topic = result.get("recommended_topic", "").lower()
                for ex in excluded:
                    if ex.lower() in rec_topic:
                        result["recommended_topic"] = None
                        result["reason"] = "Filtered out — matched excluded topic"

            return result

        except Exception as e:
            log.error(f"Content intelligence recommendation failed: {e}")
            return {
                "error": str(e),
                "recommended_topic": None,
                "reason": "Recommendation generation failed",
            }
