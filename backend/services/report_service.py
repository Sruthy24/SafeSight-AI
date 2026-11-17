import os
import time
from datetime import datetime
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    HRFlowable
)
from reportlab.lib.units import inch

from backend.config import REPORT_FOLDER, BASE_DIR
from backend.database.db import (
    create_report_record,
    get_violations,
    get_dashboard_statistics,
    get_inspections
)

def generate_pdf_report(title="SafeSight AI - Workplace Safety Audit Report",
                        filters=None, include_snapshots=True, inspection_id=None):
    """
    Generates a formal, professional workplace safety compliance PDF report
    using ReportLab and stores the record in SQLite.
    """
    filters = filters or {}
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"SafeSight_Audit_Report_{timestamp_str}.pdf"
    pdf_path = REPORT_FOLDER / filename

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=12
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=14,
        spaceAfter=8
    )

    normal_text = ParagraphStyle(
        'NormalText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    badge_high = ParagraphStyle(
        'BadgeHigh',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#dc2626')
    )

    badge_med = ParagraphStyle(
        'BadgeMed',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#ea580c')
    )

    badge_low = ParagraphStyle(
        'BadgeLow',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#ca8a04')
    )

    story = []

    # SafeSight AI Branding Banner
    header_data = [
        [
            Paragraph("<b>SAFESIGHT AI</b><br/><font size=8 color='#475569'>Workplace Safety & PPE Monitoring System</font>", title_style),
            Paragraph(f"<b>Audit Date:</b> {datetime.now().strftime('%B %d, %Y')}<br/><b>Time:</b> {datetime.now().strftime('%H:%M:%S UTC')}<br/><b>Doc:</b> {filename[:25]}...", subtitle_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[3.8 * inch, 3.2 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceAfter=14))

    # Fetch stats
    stats = get_dashboard_statistics()
    inspections_list = get_inspections(limit=10)
    violations_list = get_violations(
        severity=filters.get('severity'),
        audit_status=filters.get('audit_status'),
        violation_type=filters.get('violation_type'),
        limit=50
    )

    # Executive Summary Scorecard
    story.append(Paragraph("1. Executive Compliance Scorecard", section_heading))

    scorecard_data = [
        [
            Paragraph("<b>Overall Compliance</b>", normal_text),
            Paragraph("<b>Total Inspections</b>", normal_text),
            Paragraph("<b>Total Violations</b>", normal_text),
            Paragraph("<b>High-Severity Hazards</b>", normal_text)
        ],
        [
            Paragraph(f"<font size=16 color='#16a34a'><b>{stats['compliance_rate']}%</b></font>", normal_text),
            Paragraph(f"<font size=16 color='#2563eb'><b>{stats['total_inspections']}</b></font>", normal_text),
            Paragraph(f"<font size=16 color='#ea580c'><b>{stats['total_violations']}</b></font>", normal_text),
            Paragraph(f"<font size=16 color='#dc2626'><b>{stats['high_severity_violations']}</b></font>", normal_text)
        ]
    ]
    scorecard_table = Table(scorecard_data, colWidths=[1.8 * inch, 1.8 * inch, 1.8 * inch, 1.8 * inch])
    scorecard_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f8fafc')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(scorecard_table)
    story.append(Spacer(1, 12))

    # PPE Breakdown Summary
    story.append(Paragraph("2. PPE Non-Compliance Breakdown", section_heading))
    breakdown_data = [
        [
            Paragraph("PPE Category", table_header),
            Paragraph("Detected Violations", table_header),
            Paragraph("Risk Severity", table_header),
            Paragraph("Standard OSHA / Safety Protocol", table_header)
        ],
        [
            Paragraph("Hard Hat / Helmet", normal_text),
            Paragraph(str(stats['helmet_violations']), normal_text),
            Paragraph("HIGH", badge_high),
            Paragraph("Mandatory overhead protection in all active industrial zones.", normal_text)
        ],
        [
            Paragraph("High-Visibility Safety Vest", normal_text),
            Paragraph(str(stats['vest_violations']), normal_text),
            Paragraph("HIGH", badge_high),
            Paragraph("Required for vehicular and heavy equipment traffic visibility.", normal_text)
        ],
        [
            Paragraph("Protective Eyewear / Goggles", normal_text),
            Paragraph(str(stats['goggles_violations']), normal_text),
            Paragraph("MEDIUM", badge_med),
            Paragraph("Required in cutting, grinding, chemical, and welding areas.", normal_text)
        ]
    ]
    breakdown_table = Table(breakdown_data, colWidths=[1.8 * inch, 1.2 * inch, 1.0 * inch, 3.2 * inch])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(breakdown_table)
    story.append(Spacer(1, 14))

    # Detailed Violations Table
    story.append(Paragraph(f"3. Detailed Violation Records & Audit Status ({len(violations_list)} Records)", section_heading))

    if violations_list:
        v_table_data = [
            [
                Paragraph("Snapshot", table_header),
                Paragraph("Inspection Ref", table_header),
                Paragraph("Violation Type", table_header),
                Paragraph("Severity", table_header),
                Paragraph("Conf", table_header),
                Paragraph("Audit Status", table_header)
            ]
        ]

        for item in violations_list[:15]:
            # Load snapshot if available
            snap_flowable = Paragraph("No Preview", normal_text)
            if include_snapshots and item.get('snapshot_path'):
                snap_full = BASE_DIR / item['snapshot_path']
                if snap_full.exists():
                    try:
                        snap_flowable = RLImage(str(snap_full), width=0.8 * inch, height=0.6 * inch)
                    except Exception:
                        snap_flowable = Paragraph("[Image]", normal_text)

            sev = item.get('severity', 'Medium')
            sev_flowable = badge_high if sev == 'High' else (badge_med if sev == 'Medium' else badge_low)

            v_table_data.append([
                snap_flowable,
                Paragraph(f"<font size=7>{item.get('inspection_code', 'N/A')}</font><br/><font size=6 color='#64748b'>{item.get('source_filename', '')[:16]}</font>", normal_text),
                Paragraph(f"<b>{item.get('violation_type', '')}</b>", normal_text),
                Paragraph(sev, sev_flowable),
                Paragraph(f"{int(float(item.get('confidence', 0.0)) * 100)}%", normal_text),
                Paragraph(f"<b>{item.get('audit_status', 'Detected')}</b>", normal_text)
            ])

        v_table = Table(v_table_data, colWidths=[1.0 * inch, 1.5 * inch, 2.0 * inch, 0.8 * inch, 0.7 * inch, 1.2 * inch])
        v_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(v_table)
    else:
        story.append(Paragraph("<i>No violation records found matching the specified criteria.</i>", normal_text))

    story.append(Spacer(1, 16))

    # Safety Recommendations & Formal Certification
    story.append(Paragraph("4. Corrective Action & Recommendations", section_heading))
    recs = (
        "• <b>Zone Access Control:</b> Enforce automatic gate interlocks where high-severity helmet or vest infractions are detected.<br/>"
        "• <b>Worker Verification:</b> All items marked as 'Requires Review' should be audited by designated safety officers via the SafeSight AI Audit portal.<br/>"
        "• <b>Auditing Schedule:</b> Periodic reviews should be conducted daily to verify false positive rates and calibrate detection thresholds."
    )
    story.append(Paragraph(recs, normal_text))
    story.append(Spacer(1, 14))

    # Footer note
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#94a3b8'), spaceAfter=8))
    footer_text = Paragraph(
        "<font size=7 color='#64748b'>Generated automatically by SafeSight AI Workplace Safety Monitoring System. "
        "Compliant with industrial visual inspection standards. Confidential – for internal safety compliance use only.</font>",
        normal_text
    )
    story.append(footer_text)

    # Build document
    doc.build(story)

    # Register in DB
    report_id, report_code = create_report_record(
        title=title,
        filename=filename,
        file_path=f"reports/{filename}",
        total_inspections=stats['total_inspections'],
        total_violations=len(violations_list),
        filter_criteria=filters
    )

    return {
        'report_id': report_id,
        'report_code': report_code,
        'filename': filename,
        'download_url': f"api/reports/{report_id}/download"
    }
