from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


class FrameInput(BaseModel):
    capture_id: str
    angle: Literal["FRONT", "LEFT", "RIGHT"]
    url: HttpUrl


class Preferences(BaseModel):
    desired_length: str = "short"
    maintenance: str = "low"
    texture: str = "natural"
    fade_preference: str = "low"
    overall_style: str = "clean"


class ValidateFramesRequest(BaseModel):
    frames: list[FrameInput] = Field(min_length=3, max_length=3)
    preferences: Preferences | None = None

    @model_validator(mode="after")
    def require_all_angles(self) -> ValidateFramesRequest:
        angles = {frame.angle for frame in self.frames}
        if angles != {"FRONT", "LEFT", "RIGHT"}:
            raise ValueError("Exactly one FRONT, LEFT, and RIGHT frame is required")
        return self


class FrameMetrics(BaseModel):
    capture_id: str
    angle: str
    width: int
    height: int
    brightness: float
    sharpness: float
    face_count: int
    face_size: float
    yaw: float
    hairline_visible: bool
    pose_score: float
    quality_score: float
    accepted: bool
    rejection_reason: str | None = None


class StyleSuggestion(BaseModel):
    id: str
    name: str
    category: str
    description: str
    reason: str


class ValidateFramesResponse(BaseModel):
    selected_capture_id: str
    metrics: list[FrameMetrics]
    suggestions: list[StyleSuggestion]


class GenerateRequest(BaseModel):
    generation_id: str
    input_url: HttpUrl
    prompt: str = Field(min_length=20, max_length=6000)


class GenerateResponse(BaseModel):
    job_id: str
    status: str


class JobResponse(BaseModel):
    job_id: str
    status: str
