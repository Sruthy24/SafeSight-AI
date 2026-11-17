import os
import uuid
import time
import cv2
from pathlib import Path
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from backend.config import (
    UPLOAD_FOLDER,
    PROCESSED_FOLDER,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_VIDEO_EXTENSIONS,
    MAX_CONTENT_LENGTH,
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_SAFETY_RULES
)
from backend.services.yolo_service import yolo_service
from backend.services.video_service import process_video_background
from backend.database.db import (
    create_inspection,
    add_violation,
    create_video_job,
    get_video_job
)

analysis_bp = Blueprint('analysis_bp', __name__)

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

@analysis_bp.route('/analyze/image', methods=['POST'])
@jwt_required()
def analyze_image():
    """Endpoint for uploading and analyzing a single workplace image."""
    file = request.files.get('file') or request.files.get('image')
    if not file or file.filename == '':
        return jsonify({'error': 'No file uploaded or file name is empty'}), 400

    filename = secure_filename(file.filename)
    if not allowed_file(filename, ALLOWED_IMAGE_EXTENSIONS):
        return jsonify({
            'error': f'Unsupported file format. Allowed formats: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'
        }), 400

    # Read confidence and rules from form data if provided
    try:
        conf = float(request.form.get('confidence', DEFAULT_CONFIDENCE_THRESHOLD))
    except (ValueError, TypeError):
        conf = DEFAULT_CONFIDENCE_THRESHOLD

    rules = {
        'require_helmet': {
            'enabled': request.form.get('require_helmet', 'true').lower() == 'true',
            'severity': 'High'
        },
        'require_vest': {
            'enabled': request.form.get('require_vest', 'true').lower() == 'true',
            'severity': 'High'
        },
        'require_goggles': {
            'enabled': request.form.get('require_goggles', 'false').lower() == 'true',
            'severity': 'Medium'
        }
    }

    demo_mode = request.form.get('demo_mode', 'false').lower() == 'true'

    # Save original file
    unique_prefix = int(time.time() * 1000)
    saved_filename = f"{unique_prefix}_{filename}"
    upload_path = UPLOAD_FOLDER / saved_filename
    file.save(str(upload_path))
    file_size = os.path.getsize(str(upload_path))

    if file_size > MAX_CONTENT_LENGTH:
        if upload_path.exists():
            upload_path.unlink()
        return jsonify({'error': f'File exceeds maximum limit of {MAX_CONTENT_LENGTH // (1024 * 1024)}MB'}), 400

    try:
        # Run YOLO inference & PPE rule evaluation
        result = yolo_service.analyze_image(
            upload_path,
            confidence_threshold=conf,
            rules=rules,
            is_demo_mode=demo_mode
        )

        # Save annotated image
        annotated_filename = f"annotated_{saved_filename}"
        annotated_path = PROCESSED_FOLDER / annotated_filename
        cv2.imwrite(str(annotated_path), result['annotated_image'])

        # Store in SQLite database
        rel_orig_path = f"uploads/{saved_filename}"
        rel_annotated_path = f"processed/{annotated_filename}"

        # Camera & Zone parameters (Milestone 3)
        camera_id = request.form.get('camera_id', 'CAM-01')
        zone = request.form.get('zone', 'Zone A')

        inspection_id, code = create_inspection(
            filename=filename,
            media_type='image',
            file_size=file_size,
            total_persons=result['total_persons'],
            total_ppe_detected=result['total_ppe_detected'],
            total_violations=result['total_violations'],
            compliance_rate=result['compliance_rate'],
            processing_time_ms=result['processing_time_ms'],
            original_path=rel_orig_path,
            annotated_path=rel_annotated_path,
            is_demo=result['is_demo'],
            camera_id=camera_id,
            zone=zone
        )

        # Persist violations
        saved_violations = []
        for v in result['violations']:
            v_id = add_violation(
                inspection_id=inspection_id,
                violation_type=v['type'],
                severity=v['severity'],
                confidence=v['confidence'],
                bbox=v.get('bbox', []),
                snapshot_path=v.get('snapshot_path'),
                audit_status=v.get('audit_status', 'Detected'),
                notes=v.get('reason', ''),
                camera_id=camera_id,
                zone=zone
            )
            v['id'] = v_id
            v['inspection_id'] = inspection_id
            saved_violations.append(v)

        return jsonify({
            'success': True,
            'inspection_id': inspection_id,
            'inspection_code': code,
            'filename': filename,
            'original_url': f"api/files/{rel_orig_path}",
            'annotated_url': f"api/files/{rel_annotated_path}",
            'total_persons': result['total_persons'],
            'total_ppe_detected': result['total_ppe_detected'],
            'total_violations': result['total_violations'],
            'compliance_rate': result['compliance_rate'],
            'processing_time_ms': result['processing_time_ms'],
            'is_demo': bool(result['is_demo']),
            'violations': saved_violations,
            'raw_detections': result['raw_detections']
        }), 200

    except Exception as e:
        print(f"Error analyzing image: {e}")
        return jsonify({'error': f"Image analysis failed: {str(e)}"}), 500

@analysis_bp.route('/analyze/video', methods=['POST'])
@jwt_required()
def analyze_video():
    """Endpoint for uploading a video and initiating background safety analysis."""
    file = request.files.get('file') or request.files.get('video')
    if not file or file.filename == '':
        return jsonify({'error': 'No video file provided'}), 400

    filename = secure_filename(file.filename)
    if not allowed_file(filename, ALLOWED_VIDEO_EXTENSIONS):
        return jsonify({
            'error': f'Unsupported video format. Allowed formats: {", ".join(ALLOWED_VIDEO_EXTENSIONS)}'
        }), 400

    try:
        conf = float(request.form.get('confidence', DEFAULT_CONFIDENCE_THRESHOLD))
    except (ValueError, TypeError):
        conf = DEFAULT_CONFIDENCE_THRESHOLD

    rules = {
        'require_helmet': {'enabled': request.form.get('require_helmet', 'true').lower() == 'true', 'severity': 'High'},
        'require_vest': {'enabled': request.form.get('require_vest', 'true').lower() == 'true', 'severity': 'High'},
        'require_goggles': {'enabled': request.form.get('require_goggles', 'false').lower() == 'true', 'severity': 'Medium'}
    }

    job_id = str(uuid.uuid4())
    unique_prefix = int(time.time() * 1000)
    saved_filename = f"{unique_prefix}_{filename}"
    upload_path = UPLOAD_FOLDER / saved_filename
    file.save(str(upload_path))
    file_size = os.path.getsize(str(upload_path))

    if file_size > MAX_CONTENT_LENGTH:
        if upload_path.exists():
            upload_path.unlink()
        return jsonify({'error': f'Video exceeds limit of {MAX_CONTENT_LENGTH // (1024 * 1024)}MB'}), 400

    # Register job in DB
    create_video_job(job_id=job_id, filename=filename)

    # Spawn background worker
    process_video_background(
        job_id=job_id,
        video_path=upload_path,
        filename=filename,
        file_size=file_size,
        confidence_threshold=conf,
        rules=rules
    )

    return jsonify({
        'success': True,
        'job_id': job_id,
        'filename': filename,
        'status': 'queued',
        'message': 'Video analysis task initiated successfully.'
    }), 202

@analysis_bp.route('/jobs/<job_id>', methods=['GET'])
@jwt_required()
def get_job_status(job_id):
    """Poll video processing job status and chronological violation timeline."""
    job = get_video_job(job_id)
    if not job:
        return jsonify({'error': f"Job '{job_id}' not found"}), 404

    return jsonify(job), 200
