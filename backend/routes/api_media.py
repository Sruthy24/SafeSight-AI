import os
from pathlib import Path
from flask import Blueprint, send_file, jsonify, abort
from flask_jwt_extended import jwt_required
from backend.config import BASE_DIR, UPLOAD_FOLDER, PROCESSED_FOLDER

media_bp = Blueprint('media_bp', __name__)

@media_bp.route('/files/<path:subpath>', methods=['GET'])
@jwt_required()
def serve_file(subpath):
    """
    Safely serves uploaded or processed visual media with strict path traversal checks.
    """
    try:
        # Resolve target path
        target_path = (BASE_DIR / subpath).resolve()

        # Security check: must reside inside UPLOAD_FOLDER or PROCESSED_FOLDER
        valid_upload = UPLOAD_FOLDER.resolve() in target_path.parents or target_path == UPLOAD_FOLDER.resolve()
        valid_processed = PROCESSED_FOLDER.resolve() in target_path.parents or target_path == PROCESSED_FOLDER.resolve()

        if not (valid_upload or valid_processed):
            return jsonify({'error': 'Access denied: Path traversal detected'}), 403

        if not target_path.exists() or not target_path.is_file():
            return jsonify({'error': 'Requested visual file not found'}), 404

        return send_file(str(target_path))
    except Exception as e:
        return jsonify({'error': f"Error serving media file: {str(e)}"}), 500
