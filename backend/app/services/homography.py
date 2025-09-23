"""Homography helpers for transforming between image and court coordinates."""
from __future__ import annotations

from typing import Iterable, List, Sequence, Tuple

import numpy as np

try:  # pragma: no cover - optional dependency
    import cv2  # type: ignore

    _HAS_CV2 = True
except Exception:  # pragma: no cover - we fall back to numpy implementation
    cv2 = None  # type: ignore
    _HAS_CV2 = False


Point = Tuple[float, float]


def _validate_points(points: Sequence[Sequence[float]]) -> np.ndarray:
    if len(points) < 4:
        raise ValueError("At least four points are required to compute a homography")
    array = np.asarray(points, dtype=float)
    if array.shape[1] != 2:
        raise ValueError("Points must be 2D coordinates")
    return array


def compute_h(image_pts: Sequence[Sequence[float]], court_pts: Sequence[Sequence[float]]) -> List[List[float]]:
    """Compute the planar homography mapping image points to court coordinates.

    Parameters
    ----------
    image_pts:
        Sequence of 2D image coordinates (pixels).
    court_pts:
        Sequence of corresponding 2D court coordinates (meters).

    Returns
    -------
    list[list[float]]
        A 3x3 homography matrix (row-major) that maps image coordinates to court
        coordinates.
    """

    src = _validate_points(image_pts)
    dst = _validate_points(court_pts)
    if src.shape[0] != dst.shape[0]:
        raise ValueError("Image points and court points must have the same length")

    if _HAS_CV2:
        matrix, status = cv2.findHomography(src, dst, method=0)  # type: ignore[arg-type]
        if matrix is None or (status is not None and not status.any()):
            raise ValueError("Failed to compute homography with OpenCV")
        return matrix.tolist()

    # Direct Linear Transform (DLT) implementation
    num_points = src.shape[0]
    a_matrix = []
    for i in range(num_points):
        x, y = src[i]
        u, v = dst[i]
        a_matrix.append([-x, -y, -1.0, 0.0, 0.0, 0.0, u * x, u * y, u])
        a_matrix.append([0.0, 0.0, 0.0, -x, -y, -1.0, v * x, v * y, v])

    a = np.asarray(a_matrix, dtype=float)

    # Solve Ah = 0 subject to ||h|| = 1 via SVD. The solution is the singular
    # vector corresponding to the smallest singular value.
    _, _, vh = np.linalg.svd(a)
    h = vh[-1, :]
    h = h / h[-1]
    matrix = h.reshape((3, 3))
    return matrix.tolist()


def apply_h(matrix: Sequence[Sequence[float]], points: Iterable[Point]) -> List[Point]:
    """Apply a homography matrix to a set of points."""

    mat = np.asarray(matrix, dtype=float)
    pts = np.asarray(list(points), dtype=float)
    if pts.size == 0:
        return []

    ones = np.ones((pts.shape[0], 1), dtype=float)
    homo = np.hstack([pts, ones])
    transformed = (mat @ homo.T).T
    transformed /= transformed[:, 2:3]
    return [(float(x), float(y)) for x, y in transformed[:, :2]]


def invert_h(matrix: Sequence[Sequence[float]]) -> List[List[float]]:
    """Return the inverse homography matrix."""

    mat = np.asarray(matrix, dtype=float)
    inv = np.linalg.inv(mat)
    inv /= inv[2, 2]
    return inv.tolist()
