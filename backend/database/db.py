import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path
from backend.config import DATABASE_PATH

def get_db_connection():
    """Create a thread-safe connection to the SQLite database."""
    conn = sqlite3.connect(DATABASE_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

# ---- User Authentication Helpers ----

def create_user(full_name: str, email: str, password_hash: str) -> int:
    """Insert a new user record. Returns the new user's id."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
            (full_name.strip(), email.strip().lower(), password_hash)
        )
        conn.commit()
        return cursor.lastrowid

def get_user_by_email(email: str):
    """Return a user dict by email (case-insensitive), or None if not found."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM users WHERE email = ?',
            (email.strip().lower(),)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_by_id(user_id: int):
    """Return a user dict by id, or None if not found."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def init_db():
    """Initialize database tables and indexes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Users table (authentication)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Inspections table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inspections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspection_code TEXT UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                media_type TEXT NOT NULL, -- 'image' or 'video'
                file_size INTEGER DEFAULT 0,
                total_persons INTEGER DEFAULT 0,
                total_ppe_detected INTEGER DEFAULT 0,
                total_violations INTEGER DEFAULT 0,
                compliance_rate REAL DEFAULT 100.0,
                processing_time_ms REAL DEFAULT 0.0,
                original_path TEXT,
                annotated_path TEXT,
                is_demo INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Violations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspection_id INTEGER NOT NULL,
                violation_type TEXT NOT NULL, -- 'Missing Helmet', 'Missing Safety Vest', 'Missing Goggles', etc.
                severity TEXT NOT NULL,       -- 'High', 'Medium', 'Low'
                confidence REAL DEFAULT 0.0,
                bbox TEXT,                    -- JSON array [x1, y1, x2, y2]
                snapshot_path TEXT,
                audit_status TEXT DEFAULT 'Detected', -- 'Detected', 'Verified', 'False Positive', 'Requires Review'
                notes TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE CASCADE
            )
        ''')

        # Video jobs table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS video_jobs (
                job_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                status TEXT DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
                progress_pct INTEGER DEFAULT 0,
                processed_frames INTEGER DEFAULT 0,
                total_frames INTEGER DEFAULT 0,
                duration_sec REAL DEFAULT 0.0,
                violations_count INTEGER DEFAULT 0,
                inspection_id INTEGER,
                error_message TEXT,
                timeline_json TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Reports table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_code TEXT UNIQUE NOT NULL,
                report_title TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                total_inspections INTEGER DEFAULT 0,
                total_violations INTEGER DEFAULT 0,
                filter_criteria TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # ── Milestone 3: Safe column migrations on inspections & violations ──
        cursor.execute("PRAGMA table_info(inspections)")
        insp_cols = [r[1] for r in cursor.fetchall()]
        if 'camera_id' not in insp_cols:
            cursor.execute("ALTER TABLE inspections ADD COLUMN camera_id TEXT DEFAULT 'CAM-01'")
        if 'zone' not in insp_cols:
            cursor.execute("ALTER TABLE inspections ADD COLUMN zone TEXT DEFAULT 'Zone A'")

        cursor.execute("PRAGMA table_info(violations)")
        viol_cols = [r[1] for r in cursor.fetchall()]
        if 'camera_id' not in viol_cols:
            cursor.execute("ALTER TABLE violations ADD COLUMN camera_id TEXT DEFAULT 'CAM-01'")
        if 'zone' not in viol_cols:
            cursor.execute("ALTER TABLE violations ADD COLUMN zone TEXT DEFAULT 'Zone A'")

        # ── Milestone 3: Incidents Table ─────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_code TEXT UNIQUE NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                camera_id TEXT DEFAULT 'CAM-01',
                zone TEXT DEFAULT 'Zone A',
                violation_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                confidence REAL DEFAULT 0.0,
                supporting_details TEXT DEFAULT '',
                related_document TEXT DEFAULT '',
                status TEXT DEFAULT 'Open', -- 'Open', 'Under Review', 'Resolved'
                notes TEXT DEFAULT '',
                violation_id INTEGER,
                inspection_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (violation_id) REFERENCES violations (id) ON DELETE SET NULL,
                FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE SET NULL
            )
        ''')

        # ── Milestone 3: Supervisor Alerts Table ─────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS supervisor_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_code TEXT UNIQUE NOT NULL,
                incident_id INTEGER,
                violation_type TEXT NOT NULL,
                camera_id TEXT DEFAULT 'CAM-01',
                zone TEXT DEFAULT 'Zone A',
                severity TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                evidence_summary TEXT DEFAULT '',
                is_read INTEGER DEFAULT 0,
                acknowledged_by TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
            )
        ''')

        # Create indexes for fast filtering
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_violations_inspection ON violations (inspection_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations (severity)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_violations_status ON violations (audit_status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_inspections_created ON inspections (created_at)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_incidents_zone ON incidents (zone)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_incidents_camera ON incidents (camera_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_read ON supervisor_alerts (is_read)')

        conn.commit()

# --- Helper Methods ---

def create_inspection(filename, media_type, file_size, total_persons, total_ppe_detected,
                      total_violations, compliance_rate, processing_time_ms,
                      original_path, annotated_path, is_demo=0, camera_id='CAM-01', zone='Zone A'):
    timestamp_str = datetime.now().strftime('%Y%m%d%H%M%S')
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM inspections')
        count = cursor.fetchone()[0] + 1
        code = f"INSP-{timestamp_str}-{count:04d}"

        cursor.execute('''
            INSERT INTO inspections (
                inspection_code, filename, media_type, file_size, total_persons,
                total_ppe_detected, total_violations, compliance_rate,
                processing_time_ms, original_path, annotated_path, is_demo,
                camera_id, zone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (code, filename, media_type, file_size, total_persons,
              total_ppe_detected, total_violations, compliance_rate,
              processing_time_ms, original_path, annotated_path, is_demo,
              camera_id, zone))
        inspection_id = cursor.lastrowid
        conn.commit()
        return inspection_id, code

def add_violation(inspection_id, violation_type, severity, confidence, bbox, snapshot_path,
                  audit_status='Detected', notes='', camera_id='CAM-01', zone='Zone A'):
    bbox_str = json.dumps(bbox) if isinstance(bbox, (list, tuple)) else str(bbox)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO violations (
                inspection_id, violation_type, severity, confidence, bbox, snapshot_path,
                audit_status, notes, camera_id, zone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (inspection_id, violation_type, severity, confidence, bbox_str, snapshot_path,
              audit_status, notes, camera_id, zone))
        v_id = cursor.lastrowid
        conn.commit()
        return v_id

def get_inspections(limit=50, offset=0, media_type=None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = 'SELECT * FROM inspections'
        params = []
        if media_type:
            query += ' WHERE media_type = ?'
            params.append(media_type)
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_inspection_by_id(inspection_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM inspections WHERE id = ?', (inspection_id,))
        row = cursor.fetchone()
        if not row:
            return None
        insp = dict(row)
        cursor.execute('SELECT * FROM violations WHERE inspection_id = ? ORDER BY id ASC', (inspection_id,))
        v_rows = cursor.fetchall()
        violations = []
        for v in v_rows:
            v_dict = dict(v)
            try:
                v_dict['bbox'] = json.loads(v_dict['bbox']) if v_dict['bbox'] else []
            except Exception:
                pass
            violations.append(v_dict)
        insp['violations'] = violations
        return insp

def get_violations(severity=None, audit_status=None, violation_type=None, limit=100, offset=0):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = '''
            SELECT v.*, i.inspection_code, i.filename as source_filename, i.media_type
            FROM violations v
            JOIN inspections i ON v.inspection_id = i.id
            WHERE 1=1
        '''
        params = []
        if severity and severity != 'all':
            query += ' AND v.severity = ?'
            params.append(severity)
        if audit_status and audit_status != 'all':
            query += ' AND v.audit_status = ?'
            params.append(audit_status)
        if violation_type and violation_type != 'all':
            query += ' AND v.violation_type LIKE ?'
            params.append(f'%{violation_type}%')

        query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d['bbox'] = json.loads(d['bbox']) if d['bbox'] else []
            except Exception:
                pass
            result.append(d)
        return result

def update_violation_status(violation_id, audit_status, notes=None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if notes is not None:
            cursor.execute('''
                UPDATE violations SET audit_status = ?, notes = ? WHERE id = ?
            ''', (audit_status, notes, violation_id))
        else:
            cursor.execute('''
                UPDATE violations SET audit_status = ? WHERE id = ?
            ''', (audit_status, violation_id))
        conn.commit()
        return cursor.rowcount > 0

def create_video_job(job_id, filename, total_frames=0, duration_sec=0.0):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO video_jobs (job_id, filename, status, total_frames, duration_sec)
            VALUES (?, ?, 'queued', ?, ?)
        ''', (job_id, filename, total_frames, duration_sec))
        conn.commit()

def update_video_job(job_id, status=None, progress_pct=None, processed_frames=None,
                     violations_count=None, inspection_id=None, error_message=None, timeline_json=None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        updates = ['updated_at = CURRENT_TIMESTAMP']
        params = []

        if status is not None:
            updates.append('status = ?')
            params.append(status)
        if progress_pct is not None:
            updates.append('progress_pct = ?')
            params.append(progress_pct)
        if processed_frames is not None:
            updates.append('processed_frames = ?')
            params.append(processed_frames)
        if violations_count is not None:
            updates.append('violations_count = ?')
            params.append(violations_count)
        if inspection_id is not None:
            updates.append('inspection_id = ?')
            params.append(inspection_id)
        if error_message is not None:
            updates.append('error_message = ?')
            params.append(error_message)
        if timeline_json is not None:
            updates.append('timeline_json = ?')
            params.append(timeline_json)

        params.append(job_id)
        cursor.execute(f"UPDATE video_jobs SET {', '.join(updates)} WHERE job_id = ?", params)
        conn.commit()

def get_video_job(job_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM video_jobs WHERE job_id = ?', (job_id,))
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d['timeline'] = json.loads(d.get('timeline_json', '[]') or '[]')
        except Exception:
            d['timeline'] = []
        return d

def create_report_record(title, filename, file_path, total_inspections, total_violations, filter_criteria):
    timestamp_str = datetime.now().strftime('%Y%m%d%H%M%S')
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM reports')
        count = cursor.fetchone()[0] + 1
        code = f"REP-{timestamp_str}-{count:04d}"

        criteria_str = json.dumps(filter_criteria) if isinstance(filter_criteria, dict) else str(filter_criteria)
        cursor.execute('''
            INSERT INTO reports (
                report_code, report_title, filename, file_path,
                total_inspections, total_violations, filter_criteria
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (code, title, filename, file_path, total_inspections, total_violations, criteria_str))
        r_id = cursor.lastrowid
        conn.commit()
        return r_id, code

def get_reports(limit=50):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reports ORDER BY created_at DESC LIMIT ?', (limit,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d['filter_criteria'] = json.loads(d['filter_criteria'])
            except Exception:
                pass
            result.append(d)
        return result

def get_report_by_id(report_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reports WHERE id = ?', (report_id,))
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d['filter_criteria'] = json.loads(d['filter_criteria'])
        except Exception:
            pass
        return d

def get_dashboard_statistics():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Total inspections & media types
        cursor.execute('SELECT COUNT(*) FROM inspections')
        total_inspections = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM inspections WHERE media_type = 'image'")
        total_images = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM inspections WHERE media_type = 'video'")
        total_videos = cursor.fetchone()[0]

        cursor.execute('SELECT AVG(compliance_rate) FROM inspections')
        avg_compliance = cursor.fetchone()[0]
        compliance_pct = round(avg_compliance, 1) if avg_compliance is not None else 100.0

        # Violations count
        cursor.execute('SELECT COUNT(*) FROM violations')
        total_violations = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM violations WHERE severity = 'High'")
        high_severity_violations = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM violations WHERE severity = 'Medium'")
        medium_severity_violations = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM violations WHERE severity = 'Low'")
        low_severity_violations = cursor.fetchone()[0]

        # Specific PPE categories
        cursor.execute("SELECT COUNT(*) FROM violations WHERE violation_type LIKE '%Helmet%'")
        helmet_violations = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM violations WHERE violation_type LIKE '%Vest%'")
        vest_violations = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM violations WHERE violation_type LIKE '%Goggle%' OR violation_type LIKE '%Eye%'")
        goggles_violations = cursor.fetchone()[0]

        # Violations by category breakdown for charts
        cursor.execute('''
            SELECT violation_type, COUNT(*) as count
            FROM violations
            GROUP BY violation_type
            ORDER BY count DESC
        ''')
        violations_by_category = [{'category': row['violation_type'], 'count': row['count']} for row in cursor.fetchall()]

        # Severity distribution for charts
        severity_distribution = [
            {'name': 'High Severity', 'value': high_severity_violations, 'color': '#ef4444'},
            {'name': 'Medium Severity', 'value': medium_severity_violations, 'color': '#f97316'},
            {'name': 'Low Severity', 'value': low_severity_violations, 'color': '#eab308'},
        ]

        # Recent 5 inspections
        cursor.execute('SELECT * FROM inspections ORDER BY created_at DESC LIMIT 5')
        recent_inspections = [dict(r) for r in cursor.fetchall()]

        # Recent 5 violations
        cursor.execute('''
            SELECT v.*, i.inspection_code, i.filename as source_filename
            FROM violations v
            JOIN inspections i ON v.inspection_id = i.id
            ORDER BY v.created_at DESC LIMIT 5
        ''')
        recent_violations = [dict(r) for r in cursor.fetchall()]

        return {
            'total_inspections': total_inspections,
            'total_images': total_images,
            'total_videos': total_videos,
            'total_violations': total_violations,
            'high_severity_violations': high_severity_violations,
            'medium_severity_violations': medium_severity_violations,
            'low_severity_violations': low_severity_violations,
            'helmet_violations': helmet_violations,
            'vest_violations': vest_violations,
            'goggles_violations': goggles_violations,
            'compliance_rate': compliance_pct,
            'violations_by_category': violations_by_category,
            'severity_distribution': severity_distribution,
            'recent_inspections': recent_inspections,
            'recent_violations': recent_violations
        }

# ── Milestone 3: Incident Management Helper Methods ─────────────────────────

def create_incident(violation_type, severity, confidence=0.0, camera_id='CAM-01', zone='Zone A',
                    supporting_details='', related_document='', status='Open', notes='',
                    violation_id=None, inspection_id=None, timestamp=None):
    """
    Creates an incident record. Prevents creating duplicate incidents for the same
    violation/inspection event. Returns (incident_id, incident_code, is_duplicate).
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check for duplicate incident for the same violation or inspection+type
        if violation_id is not None:
            cursor.execute('SELECT id, incident_code FROM incidents WHERE violation_id = ?', (violation_id,))
            existing = cursor.fetchone()
            if existing:
                return existing['id'], existing['incident_code'], True

        if inspection_id is not None:
            cursor.execute(
                'SELECT id, incident_code FROM incidents WHERE inspection_id = ? AND violation_type = ?',
                (inspection_id, violation_type)
            )
            existing = cursor.fetchone()
            if existing:
                return existing['id'], existing['incident_code'], True

        # Generate incident code
        ts = datetime.now()
        timestamp_str = ts.strftime('%Y%m%d%H%M%S')
        cursor.execute('SELECT COUNT(*) FROM incidents')
        count = cursor.fetchone()[0] + 1
        code = f"INC-{timestamp_str}-{count:04d}"

        time_val = timestamp or ts.strftime('%Y-%m-%d %H:%M:%S')
        details_str = json.dumps(supporting_details) if isinstance(supporting_details, (dict, list)) else str(supporting_details)

        cursor.execute('''
            INSERT INTO incidents (
                incident_code, timestamp, camera_id, zone, violation_type,
                severity, confidence, supporting_details, related_document,
                status, notes, violation_id, inspection_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (code, time_val, camera_id, zone, violation_type,
              severity, float(confidence), details_str, related_document,
              status, notes, violation_id, inspection_id))
        inc_id = cursor.lastrowid
        conn.commit()
        return inc_id, code, False


def get_incidents(status=None, severity=None, zone=None, camera_id=None, limit=100, offset=0):
    """Retrieve list of incidents with optional filters."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = 'SELECT * FROM incidents WHERE 1=1'
        params = []
        if status and status != 'all':
            query += ' AND status = ?'
            params.append(status)
        if severity and severity != 'all':
            query += ' AND severity = ?'
            params.append(severity)
        if zone and zone != 'all':
            query += ' AND zone LIKE ?'
            params.append(f'%{zone}%')
        if camera_id and camera_id != 'all':
            query += ' AND camera_id = ?'
            params.append(camera_id)

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d['supporting_details'] = json.loads(d.get('supporting_details') or '{}')
            except Exception:
                pass
            results.append(d)
        return results


def get_incident_by_id(incident_id):
    """Retrieve a single incident by its ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM incidents WHERE id = ?', (incident_id,))
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d['supporting_details'] = json.loads(d.get('supporting_details') or '{}')
        except Exception:
            pass
        return d


def update_incident_status(incident_id, status, notes=None):
    """Update incident status ('Open', 'Under Review', 'Resolved') and notes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if notes is not None:
            cursor.execute(
                'UPDATE incidents SET status = ?, notes = ? WHERE id = ?',
                (status, notes, incident_id)
            )
        else:
            cursor.execute('UPDATE incidents SET status = ? WHERE id = ?', (status, incident_id))
        conn.commit()
        return cursor.rowcount > 0


# ── Milestone 3: Supervisor Alert Helper Methods ─────────────────────────────

def create_supervisor_alert(violation_type, severity, camera_id='CAM-01', zone='Zone A',
                            evidence_summary='', incident_id=None, timestamp=None):
    """
    Creates an in-app supervisor alert for high-severity violations.
    Prevents duplicate unread alerts for the same incident or same event.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check for existing unread alert for the same incident
        if incident_id is not None:
            cursor.execute(
                'SELECT id, alert_code FROM supervisor_alerts WHERE incident_id = ? AND is_read = 0',
                (incident_id,)
            )
            existing = cursor.fetchone()
            if existing:
                return existing['id'], existing['alert_code'], True

        # Check for duplicate unread alert for same camera + violation_type
        cursor.execute(
            '''SELECT id, alert_code FROM supervisor_alerts
               WHERE camera_id = ? AND violation_type = ? AND is_read = 0''',
            (camera_id, violation_type)
        )
        existing = cursor.fetchone()
        if existing:
            return existing['id'], existing['alert_code'], True

        ts = datetime.now()
        timestamp_str = ts.strftime('%Y%m%d%H%M%S')
        cursor.execute('SELECT COUNT(*) FROM supervisor_alerts')
        count = cursor.fetchone()[0] + 1
        code = f"ALT-{timestamp_str}-{count:04d}"

        time_val = timestamp or ts.strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute('''
            INSERT INTO supervisor_alerts (
                alert_code, incident_id, violation_type, camera_id,
                zone, severity, timestamp, evidence_summary, is_read
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ''', (code, incident_id, violation_type, camera_id,
              zone, severity, time_val, evidence_summary))
        alert_id = cursor.lastrowid
        conn.commit()
        return alert_id, code, False


def get_supervisor_alerts(unread_only=False, limit=50):
    """Fetch supervisor alerts with incident details."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = '''
            SELECT a.*, i.incident_code, i.status as incident_status, i.confidence
            FROM supervisor_alerts a
            LEFT JOIN incidents i ON a.incident_id = i.id
            WHERE 1=1
        '''
        params = []
        if unread_only:
            query += ' AND a.is_read = 0'

        query += ' ORDER BY a.timestamp DESC LIMIT ?'
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def mark_alert_read(alert_id):
    """Mark a supervisor alert as read."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE supervisor_alerts SET is_read = 1 WHERE id = ?', (alert_id,))
        conn.commit()
        return cursor.rowcount > 0


def acknowledge_alert(alert_id, acknowledged_by='Safety Supervisor'):
    """Acknowledge an alert and mark as read."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE supervisor_alerts SET is_read = 1, acknowledged_by = ? WHERE id = ?',
            (acknowledged_by, alert_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def get_multimodal_dashboard_stats():
    """
    Combines Milestone 1 (Visual detections), Milestone 2 (Knowledge base),
    and Milestone 3 (Incidents, Alerts, Camera/Zone metrics) into one unified payload.
    """
    stats = get_dashboard_statistics()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Incidents statistics
        cursor.execute('SELECT COUNT(*) FROM incidents')
        total_incidents = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM incidents WHERE status = 'Open'")
        open_incidents = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM incidents WHERE status = 'Under Review'")
        under_review_incidents = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM incidents WHERE status = 'Resolved'")
        resolved_incidents = cursor.fetchone()[0]

        # Supervisor alerts statistics
        cursor.execute('SELECT COUNT(*) FROM supervisor_alerts WHERE is_read = 0')
        unread_alerts_count = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM supervisor_alerts')
        total_alerts_count = cursor.fetchone()[0]

        # Camera-wise activity
        cursor.execute('''
            SELECT
                COALESCE(camera_id, 'CAM-01') as camera_id,
                COUNT(DISTINCT id) as inspections_count,
                SUM(total_violations) as violations_count,
                ROUND(AVG(compliance_rate), 1) as avg_compliance
            FROM inspections
            GROUP BY camera_id
            ORDER BY camera_id ASC
        ''')
        camera_activity = [dict(r) for r in cursor.fetchall()]

        # Zone-wise violation statistics
        cursor.execute('''
            SELECT
                COALESCE(zone, 'Zone A') as zone,
                COUNT(*) as count
            FROM violations
            GROUP BY zone
            ORDER BY count DESC
        ''')
        zone_violations = [dict(r) for r in cursor.fetchall()]

        # Recent incidents (5)
        cursor.execute('SELECT * FROM incidents ORDER BY timestamp DESC LIMIT 5')
        recent_incidents = [dict(r) for r in cursor.fetchall()]

        # Recent alerts (5)
        cursor.execute('''
            SELECT a.*, i.incident_code
            FROM supervisor_alerts a
            LEFT JOIN incidents i ON a.incident_id = i.id
            ORDER BY a.timestamp DESC LIMIT 5
        ''')
        recent_alerts = [dict(r) for r in cursor.fetchall()]

        stats.update({
            'total_incidents': total_incidents,
            'open_incidents': open_incidents,
            'under_review_incidents': under_review_incidents,
            'resolved_incidents': resolved_incidents,
            'unread_alerts_count': unread_alerts_count,
            'total_alerts_count': total_alerts_count,
            'camera_activity': camera_activity,
            'zone_violations': zone_violations,
            'recent_incidents': recent_incidents,
            'recent_alerts': recent_alerts,
        })
        return stats


def seed_m3_metadata():
    """
    Backfills camera_id and zone on existing inspections & violations to reflect
    real plant areas (CAM-01 / Zone A, CAM-02 / Zone B, CAM-03 / Zone C).
    Also seeds initial incidents and supervisor alerts if none exist.
    """
    sample_viols = []
    need_seed = False

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Distribute existing inspections across CAM-01, CAM-02, CAM-03
        camera_map = [
            ('CAM-01', 'Zone A'),
            ('CAM-02', 'Zone B'),
            ('CAM-03', 'Zone C'),
        ]
        cursor.execute('SELECT id FROM inspections ORDER BY id ASC')
        insp_ids = [r[0] for r in cursor.fetchall()]
        for idx, i_id in enumerate(insp_ids):
            cam, zone = camera_map[idx % len(camera_map)]
            cursor.execute('UPDATE inspections SET camera_id = ?, zone = ? WHERE id = ?', (cam, zone, i_id))
            cursor.execute('UPDATE violations SET camera_id = ?, zone = ? WHERE inspection_id = ?', (cam, zone, i_id))

        # Check if incidents exist; if not, fetch seed violations
        cursor.execute('SELECT COUNT(*) FROM incidents')
        if cursor.fetchone()[0] < 4:
            need_seed = True
            cursor.execute('''
                SELECT v.id, v.inspection_id, v.violation_type, v.severity, v.confidence,
                       v.notes, v.created_at, v.camera_id, v.zone, i.filename
                FROM violations v
                JOIN inspections i ON v.inspection_id = i.id
                WHERE v.severity = 'High'
                GROUP BY v.inspection_id, v.violation_type
                ORDER BY v.created_at DESC
                LIMIT 6
            ''')
            sample_viols = [dict(r) for r in cursor.fetchall()]

        conn.commit()

    # Now create incidents and alerts outside the initial connection
    if need_seed and sample_viols:
        for v in sample_viols:
            doc_ref = "SafeSight Safety Manual (Section 3.2: Mandatory PPE Protocols)"
            inc_id, code, _ = create_incident(
                violation_type=v['violation_type'],
                severity=v['severity'],
                confidence=v['confidence'],
                camera_id=v['camera_id'] or 'CAM-01',
                zone=v['zone'] or 'Zone A',
                supporting_details={
                    'source_media': v['filename'],
                    'notes': v['notes'],
                    'auto_flagged': True
                },
                related_document=doc_ref,
                status='Open' if v['id'] % 2 == 0 else 'Under Review',
                notes=v['notes'] or f"Detected by {v['camera_id']} in {v['zone']}",
                violation_id=v['id'],
                inspection_id=v['inspection_id'],
                timestamp=v['created_at']
            )

            # Generate alert for the top 4 high severity violations
            if v['id'] % 2 == 0:
                create_supervisor_alert(
                    violation_type=v['violation_type'],
                    severity=v['severity'],
                    camera_id=v['camera_id'] or 'CAM-01',
                    zone=v['zone'] or 'Zone A',
                    evidence_summary=f"Automated Alert: {v['violation_type']} detected in {v['zone']} by {v['camera_id']} (Confidence: {int(v['confidence'] * 100)}%).",
                    incident_id=inc_id,
                    timestamp=v['created_at']
                )
