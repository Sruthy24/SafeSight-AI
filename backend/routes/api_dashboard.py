from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from backend.database.db import get_multimodal_dashboard_stats

dashboard_bp = Blueprint('dashboard_bp', __name__)

@dashboard_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def dashboard_stats():
    """Return unified Milestone 1, 2, and 3 dashboard analytics from SQLite database."""
    stats = get_multimodal_dashboard_stats()

    # Check if user explicitly requested demo preview data when empty
    include_demo = request.args.get('demo', 'false').lower() == 'true'

    is_empty = stats['total_inspections'] == 0
    if is_empty and include_demo:
        # Provide clearly marked sample demo data for student demonstration
        demo_stats = {
            'is_demo_data': True,
            'demo_label': 'Demonstration Sample Metrics (No Live Records in Database Yet)',
            'total_inspections': 24,
            'total_images': 18,
            'total_videos': 6,
            'total_violations': 14,
            'high_severity_violations': 9,
            'medium_severity_violations': 4,
            'low_severity_violations': 1,
            'helmet_violations': 8,
            'vest_violations': 5,
            'goggles_violations': 1,
            'compliance_rate': 87.5,
            'violations_by_category': [
                {'category': 'Missing Helmet', 'count': 8},
                {'category': 'Missing Safety Vest', 'count': 5},
                {'category': 'Missing Safety Goggles', 'count': 1}
            ],
            'severity_distribution': [
                {'name': 'High Severity', 'value': 9, 'color': '#ef4444'},
                {'name': 'Medium Severity', 'value': 4, 'color': '#f97316'},
                {'name': 'Low Severity', 'value': 1, 'color': '#eab308'}
            ],
            'recent_inspections': [],
            'recent_violations': []
        }
        return jsonify(demo_stats), 200

    stats['is_demo_data'] = False
    return jsonify(stats), 200
