import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.db.database import get_db
from backend.models.models import Channel, Idea, Job, JobStatus, Project, Script, Video

router = APIRouter()


def evaluate_pipeline_state(
    project: Project, last_job: Optional[Job] = None
) -> Dict[str, Any]:
    """
    Given a project, evaluate the blocking issues and warnings,
    and return a consolidated ProjectPipelineState dict.
    """
    # Initialize stages
    stages = {
        "idea": {
            "status": "not_started",
            "blockingIssues": [],
            "warnings": [],
            "lastJob": None,
        },
        "script": {
            "status": "not_started",
            "blockingIssues": [],
            "warnings": [],
            "lastJob": None,
        },
        "voice": {
            "status": "not_started",
            "blockingIssues": [],
            "warnings": [],
            "lastJob": None,
        },
        "storyboard": {
            "status": "not_started",
            "blockingIssues": [],
            "warnings": [],
            "lastJob": None,
        },
        "render": {
            "status": "not_started",
            "blockingIssues": [],
            "warnings": [],
            "lastJob": None,
        },
        "review": {
            "status": "not_started",
            "blockingIssues": [],
            "warnings": [],
            "lastJob": None,
        },
        "publish": {
            "status": "not_started",
            "blockingIssues": [],
            "warnings": [],
            "lastJob": None,
        },
    }

    # Evaluate Idea
    if project.idea_id:
        stages["idea"]["status"] = "done"
        stages["script"]["status"] = "in_progress"

    # Evaluate Script
    if project.script_id and getattr(project, "script", None):
        stages["script"]["status"] = "done"
        if not project.script.scenes:
            stages["script"]["warnings"].append("Script has no scenes")

        stages["voice"]["status"] = "in_progress"
        stages["storyboard"]["status"] = "in_progress"

        # Check Voice & Storyboard
        missing_assets = False
        for scene in project.script.scenes:
            if not getattr(scene, "asset_id", None):
                missing_assets = True

        if missing_assets:
            stages["storyboard"]["blockingIssues"].append("MISSING_ASSETS")
        else:
            stages["storyboard"]["status"] = "done"

        if (
            project.pipeline_state
            and project.pipeline_state.get("voice") == "en-US-ChristopherNeural"
        ):
            stages["voice"]["warnings"].append("DEFAULT_VOICE")
            stages["voice"]["status"] = "done"
        else:
            stages["voice"]["status"] = "done"

    if stages["storyboard"]["status"] == "done" and stages["voice"]["status"] == "done":
        stages["render"]["status"] = "in_progress"

    # Evaluate Video / Render
    if project.video_id and getattr(project, "video", None):
        if project.video.status.value in ["pending", "rendering"]:
            stages["render"]["status"] = "in_progress"
        elif project.video.status.value == "ready":
            stages["render"]["status"] = "done"
            stages["review"]["status"] = "in_progress"
        elif project.video.status.value in ["failed", "render_failed"]:
            stages["render"]["status"] = "failed"
            stages["render"]["blockingIssues"].append("Render Failed")

    # Evaluate Review
    if project.video_id and getattr(project, "video", None):
        if project.video.status.value == "approved":
            stages["review"]["status"] = "done"
            stages["publish"]["status"] = "in_progress"
        elif project.video.status.value == "rejected":
            stages["review"]["status"] = "failed"

    # Evaluate Publish
    if project.video_id and getattr(project, "video", None):
        if project.video.status.value == "uploaded":
            stages["publish"]["status"] = "done"
        elif project.video.status.value == "publish_failed":
            stages["publish"]["status"] = "failed"

    # Overlay Jobs (if we fetched related jobs, we could map them to stages here)
    if last_job:
        pass  # To be implemented when jobs are fetched per project

    return {
        "project_id": project.id,
        "title": project.title,
        "current_stage": project.current_stage or "idea",
        "pipeline_state": stages,
        "last_updated_at": (
            project.updated_at.isoformat() if project.updated_at else None
        ),
    }


class ProjectUpdateRequest(BaseModel):
    title: Optional[str] = None
    current_stage: Optional[str] = None
    idea_id: Optional[str] = None
    script_id: Optional[str] = None
    video_id: Optional[str] = None
    pipeline_state: Optional[Dict[str, Any]] = None


@router.post("")
async def create_project(
    channel_id: str,
    title: str = "Untitled Project",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if hasattr(user, "id") else user["id"]
    project = Project(
        user_id=uid, channel_id=channel_id, title=title, current_stage="idea"
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}/state")
async def get_project_state(
    project_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    uid = user.id if hasattr(user, "id") else user["id"]
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.idea),
            selectinload(Project.script),
            selectinload(Project.video),
        )
        .filter_by(id=project_id, user_id=uid)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    state = evaluate_pipeline_state(project, None)
    return state


@router.get("/{project_id}/preflight")
async def get_project_preflight(
    project_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    """
    Shared validator for determining blocking vs. warning issues for a project pipeline.
    """
    uid = user.id if hasattr(user, "id") else user["id"]
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.idea),
            selectinload(Project.script),
            selectinload(Project.video),
        )
        .filter_by(id=project_id, user_id=uid)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    state = evaluate_pipeline_state(project, None)
    return {"blockingIssues": state["blockingIssues"], "warnings": state["warnings"]}


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    update: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if hasattr(user, "id") else user["id"]
    result = await db.execute(select(Project).filter_by(id=project_id, user_id=uid))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if update.title is not None:
        project.title = update.title
    if update.current_stage is not None:
        project.current_stage = update.current_stage
    if update.idea_id is not None:
        project.idea_id = update.idea_id
    if update.script_id is not None:
        project.script_id = update.script_id
    if update.video_id is not None:
        project.video_id = update.video_id
    if update.pipeline_state is not None:
        project.pipeline_state = update.pipeline_state

    await db.commit()
    await db.refresh(project)
    return project
