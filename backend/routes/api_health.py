from datetime import datetime
from flask import Blueprint, jsonify
from backend.services.yolo_service import yolo_service
from backend.config import DEFAULT_SAFETY_RULES, MAX_CONTENT_LENGTH

health_bp = Blueprint('health_bp', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """Returns system status, YOLO engine status, and configuration."""
    model_status = yolo_service.get_status()
    return jsonify({
        'status': 'healthy',
        'application': 'SafeSight AI',
        'version': '1.0.0',
        'server_time': datetime.now().isoformat(),
        'ai_engine': model_status,
        'config': {
            'max_upload_size_mb': MAX_CONTENT_LENGTH // (1024 * 1024),
            'default_safety_rules': DEFAULT_SAFETY_RULES
        }
    }), 200
