import io
import unittest
import json
from PIL import Image
from backend.app import app
from backend.database.db import (
    init_db,
    create_inspection,
    add_violation,
    update_violation_status,
    get_violations
)

class TestSafeSightAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        init_db()

    def test_01_health_check(self):
        """Test GET /api/health returns 200 with engine status."""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertIn('ai_engine', data)

    def test_02_dashboard_stats(self):
        """Test GET /api/dashboard/stats returns stats structure."""
        response = self.client.get('/api/dashboard/stats')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('total_inspections', data)
        self.assertIn('compliance_rate', data)
        self.assertIn('violations_by_category', data)

    def test_03_db_violation_audit_workflow(self):
        """Test creating an inspection and updating violation audit status."""
        # Insert test inspection
        insp_id, code = create_inspection(
            filename='unit_test.jpg',
            media_type='image',
            file_size=1024,
            total_persons=2,
            total_ppe_detected=1,
            total_violations=1,
            compliance_rate=50.0,
            processing_time_ms=45.0,
            original_path='uploads/unit_test.jpg',
            annotated_path='processed/annotated_unit_test.jpg'
        )
        self.assertIsNotNone(insp_id)

        # Add violation
        v_id = add_violation(
            inspection_id=insp_id,
            violation_type='Missing Helmet',
            severity='High',
            confidence=0.88,
            bbox=[10, 10, 100, 200],
            snapshot_path='processed/snapshots/snap_test.jpg',
            audit_status='Detected'
        )
        self.assertIsNotNone(v_id)

        # PATCH violation audit status
        patch_res = self.client.patch(f'/api/violations/{v_id}', json={
            'audit_status': 'Verified',
            'notes': 'Confirmed by safety officer in audit'
        })
        self.assertEqual(patch_res.status_code, 200)
        patch_data = patch_res.get_json()
        self.assertEqual(patch_data.get('audit_status'), 'Verified')

    def test_04_report_generation(self):
        """Test POST /api/reports/generate creates a valid report record."""
        payload = {
            'title': 'Test Safety Audit Report',
            'include_snapshots': False
        }
        res = self.client.post('/api/reports/generate', json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('report', data)
        report_id = data['report']['report_id']

        # List reports
        list_res = self.client.get('/api/reports')
        self.assertEqual(list_res.status_code, 200)

        # Download report
        dl_res = self.client.get(f'/api/reports/{report_id}/download')
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(dl_res.mimetype, 'application/pdf')

if __name__ == '__main__':
    unittest.main()
