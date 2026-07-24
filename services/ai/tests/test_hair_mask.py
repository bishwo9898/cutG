from PIL import Image

from app.hair_mask import create_edit_masks


def test_scalp_mask_edits_hair_zone_but_protects_face_and_background() -> None:
    image = Image.new("RGB", (1000, 1400), "gray")
    strict, feathered = create_edit_masks(image, "scalp")

    assert strict.size == image.size
    assert feathered.size == image.size
    assert strict.getpixel((500, 130)) == 255
    assert strict.getpixel((500, 700)) == 0
    assert strict.getpixel((10, 200)) == 0
    assert strict.getpixel((500, 1200)) == 0
    # The full side silhouette and fringe remain editable so a short cut can remove them.
    assert strict.getpixel((90, 400)) == 255
    assert strict.getpixel((500, 520)) == 255


def test_facial_mask_leaves_scalp_locked() -> None:
    image = Image.new("RGB", (1000, 1400), "gray")
    strict, _ = create_edit_masks(image, "facial")

    assert strict.getpixel((500, 150)) == 0
    assert strict.getpixel((400, 800)) == 255
    assert strict.getpixel((500, 600)) == 0


def test_combo_mask_includes_scalp_and_facial_hair_regions() -> None:
    image = Image.new("RGB", (1000, 1400), "gray")
    strict, _ = create_edit_masks(image, "combo")

    assert strict.getpixel((500, 130)) == 255
    assert strict.getpixel((400, 800)) == 255
