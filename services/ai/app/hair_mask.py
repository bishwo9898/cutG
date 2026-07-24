from __future__ import annotations

from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter


@dataclass(frozen=True)
class FaceBox:
    left: int
    top: int
    width: int
    height: int


def _capture_face_box(image: Image.Image) -> FaceBox:
    # Accepted Hair Studio captures use a centered portrait guide. Keeping mask geometry tied to
    # that contract avoids loading a second native face model inside the paid-generation worker.
    return FaceBox(
        left=round(image.width * 0.31),
        top=round(image.height * 0.25),
        width=round(image.width * 0.38),
        height=round(image.height * 0.42),
    )


def create_edit_masks(
    image: Image.Image, edit_region: str
) -> tuple[Image.Image, Image.Image]:
    """Build a strict provider mask and a feathered local-composite mask."""

    box = _capture_face_box(image)
    strict = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(strict)
    # The editable area must contain the *entire original* hair silhouette, not just the desired
    # final silhouette. Short cuts need room to replace removed long hair with the real background.
    left = max(0, box.left - round(box.width * 0.78))
    right = min(image.width, box.left + box.width + round(box.width * 0.78))
    hair_bottom = min(image.height, box.top + round(box.height * 0.62))
    hair_top = max(0, box.top - round(box.height * 1.45))

    if edit_region in {"scalp", "combo"}:
        draw.rounded_rectangle(
            (left, hair_top, right, hair_bottom),
            radius=max(16, round(box.width * 0.24)),
            fill=255,
        )
        # Start face protection at the eye line, below normal bangs and fringe. The previous mask
        # began near the forehead and therefore composited original locks back over new hair.
        draw.rounded_rectangle(
            (
                box.left + round(box.width * 0.04),
                box.top + round(box.height * 0.55),
                box.left + round(box.width * 0.96),
                image.height,
            ),
            radius=max(8, round(box.width * 0.06)),
            fill=0,
        )

    if edit_region in {"facial", "combo"}:
        draw.rounded_rectangle(
            (
                box.left - round(box.width * 0.12),
                box.top + round(box.height * 0.48),
                box.left + round(box.width * 1.12),
                box.top + round(box.height * 1.35),
            ),
            radius=max(10, round(box.width * 0.2)),
            fill=255,
        )
        draw.ellipse(
            (
                box.left + round(box.width * 0.26),
                box.top + round(box.height * 0.38),
                box.left + round(box.width * 0.74),
                box.top + round(box.height * 0.84),
            ),
            fill=0,
        )

    feather_radius = max(3, round(min(image.size) * 0.008))
    return strict, strict.filter(ImageFilter.GaussianBlur(feather_radius))
