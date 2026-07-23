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
    left = max(0, box.left - round(box.width * 0.35))
    right = min(image.width, box.left + box.width + round(box.width * 0.35))
    hair_bottom = min(image.height, box.top + round(box.height * 0.38))
    hair_top = max(0, box.top - round(box.height * 1.45))

    if edit_region in {"scalp", "combo"}:
        draw.ellipse(
            (left, hair_top, right, hair_bottom + round(box.height * 0.08)),
            fill=255,
        )
        draw.rounded_rectangle(
            (
                left,
                max(hair_top, round(image.height * 0.12)),
                right,
                hair_bottom,
            ),
            radius=max(12, round(box.width * 0.18)),
            fill=255,
        )
        # Preserve the identity-critical face core while leaving temples, sideburns, forehead
        # overlap, ears, and the complete current hair silhouette editable.
        draw.ellipse(
            (
                box.left + round(box.width * 0.03),
                box.top + round(box.height * 0.05),
                box.left + round(box.width * 0.97),
                box.top + round(box.height * 1.18),
            ),
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
