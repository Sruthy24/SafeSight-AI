import cv2
import json
import threading
import time
from pathlib import Path

from backend.config import (
    VIDEO_FRAME_SAMPLE_INTERVAL,
    MAX_VIDEO_DURATION_SECONDS,
    DEFAULT_CONFIDENCE_THRESHOLD,
    SNAPSHOT_FOLDER,
    PROCESSED_FOLDER
)
from backend.database.db import (
    update_video_job,
    create_inspection,
    add_violation
)
from backend.services.yolo_service import yolo_service

def process_video_background(job_id, video_path, filename, file_size,
                             confidence_threshold=DEFAULT_CONFIDENCE_THRESHOLD,
                             rules=None, sample_interval=VIDEO_FRAME_SAMPLE_INTERVAL):
    """
    Worker function executed in background thread to analyze video frames,
    extract violations with timestamps, and update the SQLite job tracking table.
    """
    def _run():
        cap = None
        try:
            update_video_job(job_id, status='processing', progress_pct=5)
            cap = cv2.VideoCapture(str(video_path))

            if not cap.isOpened():
                raise ValueError("Could not open video file with OpenCV.")

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            duration_sec = total_frames / fps if total_frames > 0 else 0.0

            # Cap duration for safety
            max_frames = min(total_frames, int(MAX_VIDEO_DURATION_SECONDS * fps)) if total_frames > 0 else 9000

            timeline_events = []
            frame_idx = 0
            sampled_count = 0
            all_violations = []
            max_persons_in_frame = 0

            target_sample_step = max(1, sample_interval)

            while cap.isOpened() and frame_idx < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % target_sample_step == 0:
                    sampled_count += 1
                    timestamp_sec = round(frame_idx / fps, 1)
                    mins = int(timestamp_sec // 60)
                    secs = int(timestamp_sec % 60)
                    time_str = f"{mins:02d}:{secs:02d}"

                    # Run inference on sampled frame
                    analysis = yolo_service.analyze_image(
                        frame,
                        confidence_threshold=confidence_threshold,
                        rules=rules
                    )

                    max_persons_in_frame = max(max_persons_in_frame, analysis['total_persons'])

                    if analysis['total_violations'] > 0:
                        # Save frame snapshot
                        snap_name = f"video_{job_id}_frame_{frame_idx}.jpg"
                        snap_path = SNAPSHOT_FOLDER / snap_name
                        cv2.imwrite(str(snap_path), analysis['annotated_image'])

                        event = {
                            'frame_idx': frame_idx,
                            'timestamp_sec': timestamp_sec,
                            'timestamp_display': time_str,
                            'violations_count': analysis['total_violations'],
                            'snapshot_url': f"processed/snapshots/{snap_name}",
                            'violations': analysis['violations']
                        }
                        timeline_events.append(event)
                        all_violations.extend(analysis['violations'])

                    # Update progress every few frames
                    progress_pct = int(min(95, (frame_idx / max(1, max_frames)) * 100))
                    update_video_job(
                        job_id,
                        progress_pct=progress_pct,
                        processed_frames=sampled_count,
                        violations_count=len(all_violations)
                    )

                frame_idx += 1

            cap.release()
            cap = None

            # Video analysis completion: create inspection and violations
            total_violations_count = len(all_violations)
            compliance_rate = 100.0
            if max_persons_in_frame > 0:
                compliance_rate = max(0.0, round(100.0 - (total_violations_count * 15.0), 1))

            first_snap_path = timeline_events[0]['snapshot_url'] if timeline_events else None

            inspection_id, code = create_inspection(
                filename=filename,
                media_type='video',
                file_size=file_size,
                total_persons=max_persons_in_frame,
                total_ppe_detected=total_violations_count,
                total_violations=total_violations_count,
                compliance_rate=compliance_rate,
                processing_time_ms=round(duration_sec * 100, 1),
                original_path=f"uploads/{filename}",
                annotated_path=first_snap_path,
                is_demo=0 if yolo_service.is_custom_ppe else 1
            )

            # Insert top 20 representative violations into DB
            for v in all_violations[:20]:
                add_violation(
                    inspection_id=inspection_id,
                    violation_type=v['type'],
                    severity=v['severity'],
                    confidence=v['confidence'],
                    bbox=v.get('bbox', []),
                    snapshot_path=v.get('snapshot_path'),
                    audit_status=v.get('audit_status', 'Detected'),
                    notes=f"Identified in video {filename}"
                )

            update_video_job(
                job_id,
                status='completed',
                progress_pct=100,
                processed_frames=sampled_count,
                violations_count=total_violations_count,
                inspection_id=inspection_id,
                timeline_json=json.dumps(timeline_events)
            )
            print(f"[VideoJob] Job {job_id} completed successfully. Found {total_violations_count} violations.")

        except Exception as e:
            print(f"[VideoJob] Error processing video {job_id}: {e}")
            if cap is not None:
                cap.release()
            update_video_job(job_id, status='failed', error_message=str(e))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return thread
