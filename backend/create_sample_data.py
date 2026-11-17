"""
SafeSight AI - Sample Data & Test Image Generator
Generates sample workplace images and seeds SQLite inspection records for demonstration.
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from backend.config import UPLOAD_FOLDER, PROCESSED_FOLDER, SNAPSHOT_FOLDER
from backend.database.db import (
    init_db,
    create_inspection,
    add_violation
)

def create_sample_worker_image(output_path, has_helmet=True, has_vest=True, label="Worker #1"):
    """Creates a synthetic workplace image simulating a worker in an industrial environment."""
    width, height = 800, 600
    img = np.zeros((height, width, 3), dtype=np.uint8)

    # Background: Industrial warehouse / factory wall
    img[:] = (220, 225, 230) # light industrial gray

    # Draw structural metal beams
    cv2.rectangle(img, (50, 0), (120, height), (70, 80, 90), -1)
    cv2.rectangle(img, (680, 0), (750, height), (70, 80, 90), -1)
    cv2.line(img, (0, 150), (width, 150), (90, 100, 110), 8)
    cv2.line(img, (0, 480), (width, 480), (130, 140, 150), 12)

    # Ground floor: darker concrete
    img[480:height, :] = (140, 150, 160)

    # Safety barrier / hazard striped line
    for x in range(0, width, 40):
        pts = np.array([[x, 480], [x + 20, 480], [x - 10, 510], [x - 30, 510]], np.int32)
        cv2.fillPoly(img, [pts], (0, 180, 240)) # Yellow/black hazard stripes

    # Worker coordinates
    wx1, wy1, wx2, wy2 = 320, 160, 480, 520

    # Draw legs
    cv2.rectangle(img, (340, 390), (390, 510), (90, 60, 40), -1) # dark blue work pants
    cv2.rectangle(img, (410, 390), (460, 510), (90, 60, 40), -1)

    # Draw Torso
    if has_vest:
        # High-visibility neon orange vest with reflective silver stripes
        cv2.rectangle(img, (330, 240), (470, 400), (0, 140, 255), -1) # High-vis Orange in BGR
        # Reflective stripes
        cv2.rectangle(img, (340, 290), (460, 310), (220, 230, 240), -1)
        cv2.rectangle(img, (340, 340), (460, 360), (220, 230, 240), -1)
    else:
        # Regular dark work shirt (Violation: No hi-vis vest)
        cv2.rectangle(img, (330, 240), (470, 400), (80, 70, 60), -1)

    # Draw Head / Face
    cv2.circle(img, (400, 210), 38, (170, 200, 230), -1) # skin tone

    # Draw Helmet / Hard Hat
    if has_helmet:
        # Bright Yellow safety hard hat
        cv2.ellipse(img, (400, 195), (46, 32), 0, 180, 360, (0, 220, 240), -1) # Yellow hard hat
        cv2.rectangle(img, (350, 190), (450, 202), (0, 220, 240), -1) # helmet brim
    else:
        # Hair only (Violation: No helmet)
        cv2.ellipse(img, (400, 195), (38, 24), 0, 180, 360, (30, 30, 40), -1)

    # Add text banner
    cv2.putText(img, f"SafeSight AI Test Feed: {label}", (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (20, 30, 40), 2, cv2.LINE_AA)

    cv2.imwrite(str(output_path), img)
    print(f"[+] Generated sample image: {output_path}")

def seed_sample_database():
    """Seeds initial demonstration data into SQLite."""
    init_db()

    # Image 1: Non-Compliant Worker
    img1_name = "sample_safety_violation.jpg"
    img1_path = UPLOAD_FOLDER / img1_name
    create_sample_worker_image(img1_path, has_helmet=False, has_vest=True, label="Missing Helmet Violation")

    # Image 2: Fully Compliant Worker
    img2_name = "sample_compliant_worker.jpg"
    img2_path = UPLOAD_FOLDER / img2_name
    create_sample_worker_image(img2_path, has_helmet=True, has_vest=True, label="Compliant PPE Worker")

    # Add Inspection 1
    insp1_id, code1 = create_inspection(
        filename=img1_name,
        media_type='image',
        file_size=os.path.getsize(str(img1_path)),
        total_persons=1,
        total_ppe_detected=1,
        total_violations=1,
        compliance_rate=0.0,
        processing_time_ms=54.2,
        original_path=f"uploads/{img1_name}",
        annotated_path=f"uploads/{img1_name}",
        is_demo=0
    )

    # Violation 1
    add_violation(
        inspection_id=insp1_id,
        violation_type='Missing Helmet',
        severity='High',
        confidence=0.89,
        bbox=[320, 160, 480, 520],
        snapshot_path=f"uploads/{img1_name}",
        audit_status='Detected',
        notes='Worker observed in active overhead crane area without protective hard hat.'
    )

    # Add Inspection 2
    insp2_id, code2 = create_inspection(
        filename=img2_name,
        media_type='image',
        file_size=os.path.getsize(str(img2_path)),
        total_persons=1,
        total_ppe_detected=2,
        total_violations=0,
        compliance_rate=100.0,
        processing_time_ms=48.6,
        original_path=f"uploads/{img2_name}",
        annotated_path=f"uploads/{img2_name}",
        is_demo=0
    )

    print(f"[+] Seeded sample inspections: {code1}, {code2}")

if __name__ == '__main__':
    seed_sample_database()
