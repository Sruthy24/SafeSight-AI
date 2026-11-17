import os
from pathlib import Path
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required
from backend.services.report_service import generate_pdf_report
from backend.database.db import get_reports, get_report_by_id
from backend.config import BASE_DIR, REPORT_FOLDER

reports_bp = Blueprint('reports_bp', __name__)

@reports_bp.route('/reports/generate', methods=['POST'])
@jwt_required()
def create_report():
    """Generates an official Workplace Safety Compliance PDF report."""
    data = request.get_json(silent=True) or {}
    title = data.get('title', 'SafeSight AI - Workplace Safety Audit Report')
    filters = data.get('filters', {})
    include_snapshots = data.get('include_snapshots', True)
    inspection_id = data.get('inspection_id')

    try:
        result = generate_pdf_report(
            title=title,
            filters=filters,
            include_snapshots=include_snapshots,
            inspection_id=inspection_id
        )
        return jsonify({
            'success': True,
            'message': 'Audit PDF report generated successfully.',
            'report': result
        }), 201
    except Exception as e:
        print(f"Error generating PDF report: {e}")
        return jsonify({'error': f"Failed to generate report: {str(e)}"}), 500

@reports_bp.route('/reports', methods=['GET'])
@jwt_required()
def list_reports():
    """List previously generated PDF audit reports."""
    limit = int(request.args.get('limit', 50))
    reports = get_reports(limit=limit)
    return jsonify({
        'count': len(reports),
        'reports': reports
    }), 200

@reports_bp.route('/reports/<int:report_id>/download', methods=['GET'])
@jwt_required()
def download_report(report_id):
    """Download the actual PDF report file."""
    record = get_report_by_id(report_id)
    if not record:
        return jsonify({'error': f"Report #{report_id} not found"}), 404

    file_path = BASE_DIR / record['file_path']
    if not file_path.exists():
        # Check in REPORT_FOLDER directly
        file_path = REPORT_FOLDER / record['filename']
        if not file_path.exists():
            return jsonify({'error': 'Report file does not exist on disk'}), 404

    return send_file(
        str(file_path),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=record['filename']
    )
