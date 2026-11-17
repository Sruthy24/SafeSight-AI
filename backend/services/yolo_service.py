import os
import time
import cv2
import numpy as np
from pathlib import Path
from PIL import Image

from backend.config import (
    CUSTOM_MODEL_PATH,
    FALLBACK_MODEL_PATH,
    CLASS_MAPPINGS,
    DEFAULT_SAFETY_RULES,
    DEFAULT_CONFIDENCE_THRESHOLD,
    SNAPSHOT_FOLDER,
    PROCESSED_FOLDER
)

class YOLOSafetyService:
    def __init__(self):
        self.model = None
        self.person_model = None
        self.model_path = None
        self.model_loaded = False
        self.is_custom_ppe = False
        self.supported_classes = []
        self._load_model()

    def _load_model(self):
        """Attempts to load custom PPE model first, then fallback base model."""
        try:
            from ultralytics import YOLO

            if CUSTOM_MODEL_PATH.exists():
                print(f"[YOLO] Loading custom PPE model from: {CUSTOM_MODEL_PATH}")
                self.model = YOLO(str(CUSTOM_MODEL_PATH))
                self.model_path = str(CUSTOM_MODEL_PATH)
                self.model_loaded = True
            elif FALLBACK_MODEL_PATH.exists():
                print(f"[YOLO] Loading fallback model from: {FALLBACK_MODEL_PATH}")
                self.model = YOLO(str(FALLBACK_MODEL_PATH))
                self.model_path = str(FALLBACK_MODEL_PATH)
                self.model_loaded = True
            else:
                print(f"[YOLO] No local model file found. Attempting to initialize yolov8n.pt...")
                self.model = YOLO('yolov8n.pt')
                self.model_path = 'yolov8n.pt'
                self.model_loaded = True

            if self.model_loaded and hasattr(self.model, 'names'):
                raw_classes = list(self.model.names.values())
                self.supported_classes = raw_classes

                # Check if model has PPE specific classes
                ppe_keywords = {'helmet', 'hard-hat', 'hardhat', 'vest', 'goggles', 'glasses', 'no-helmet', 'no-vest', 'no-hardhat'}
                has_ppe = any(k in [c.lower() for c in raw_classes] for k in ppe_keywords)
                self.is_custom_ppe = has_ppe

                print(f"[YOLO] Model loaded successfully. Classes: {len(raw_classes)}. Custom PPE: {self.is_custom_ppe}")

                # If custom model specializes only in PPE items and lacks 'person', load base model as auxiliary detector
                if self.is_custom_ppe and 'person' not in [c.lower() for c in raw_classes]:
                    aux_path = str(FALLBACK_MODEL_PATH) if FALLBACK_MODEL_PATH.exists() else 'yolov8n.pt'
                    try:
                        self.person_model = YOLO(aux_path)
                        print("[YOLO] Auxiliary person detector model loaded successfully.")
                    except Exception as pe:
                        print(f"[YOLO] Auxiliary person model load note: {pe}")

        except Exception as e:
            print(f"[YOLO] Error loading model: {e}")
            self.model = None
            self.model_loaded = False
            self.is_custom_ppe = False

    def get_status(self):
        """Returns engine status for health check and UI badge."""
        return {
            'model_loaded': self.model_loaded,
            'model_path': self.model_path if self.model_loaded else None,
            'is_custom_ppe': self.is_custom_ppe,
            'classes_count': len(self.supported_classes),
            'classes': self.supported_classes[:15],
            'mode_label': 'Custom PPE YOLOv8' if self.is_custom_ppe else ('COCO Worker Baseline (Demo PPE Evaluation)' if self.model_loaded else 'Engine Offline')
        }

    def _normalize_class_name(self, raw_name):
        clean = raw_name.lower().strip().replace(' ', '_').replace('-', '_')
        for key, canonical in CLASS_MAPPINGS.items():
            if key.replace('-', '_') in clean or clean == key:
                return canonical
        return clean

    def _boxes_intersect(self, boxA, boxB):
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])
        interArea = max(0, xB - xA) * max(0, yB - yA)
        return interArea > 0

    def _compute_overlap_ratio(self, inner_box, outer_box):
        """Calculates what portion of inner_box is contained within outer_box."""
        xA = max(inner_box[0], outer_box[0])
        yA = max(inner_box[1], outer_box[1])
        xB = min(inner_box[2], outer_box[2])
        yB = min(inner_box[3], outer_box[3])
        interArea = max(0, xB - xA) * max(0, yB - yA)
        innerArea = max(1, (inner_box[2] - inner_box[0]) * (inner_box[3] - inner_box[1]))
        return interArea / innerArea

    def analyze_image(self, image_path, confidence_threshold=DEFAULT_CONFIDENCE_THRESHOLD, rules=None, is_demo_mode=False):
        """
        Runs YOLOv8 detection on an image, evaluates safety compliance rules,
        saves annotated image and violation snapshots, and returns structured results.
        """
        start_time = time.time()
        rules = rules or DEFAULT_SAFETY_RULES

        if isinstance(image_path, (str, Path)):
            img_bgr = cv2.imread(str(image_path))
            if img_bgr is None:
                raise ValueError(f"Unable to read image at path: {image_path}")
        else:
            img_bgr = image_path

        h, w = img_bgr.shape[:2]
        annotated_img = img_bgr.copy()

        detected_persons = []
        detected_ppe = []
        raw_detections = []

        if self.model_loaded and self.model is not None:
            results = self.model.predict(img_bgr, conf=confidence_threshold, verbose=False)
            boxes = results[0].boxes

            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy().tolist()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    raw_name = self.model.names.get(cls_id, f"cls_{cls_id}")
                    norm_class = self._normalize_class_name(raw_name)

                    x1, y1, x2, y2 = [int(v) for v in xyxy]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)
                    bbox = [x1, y1, x2, y2]

                    raw_detections.append({
                        'raw_class': raw_name,
                        'norm_class': norm_class,
                        'confidence': round(conf, 3),
                        'bbox': bbox
                    })

                    if norm_class == 'person':
                        detected_persons.append({
                            'id': len(detected_persons) + 1,
                            'bbox': bbox,
                            'confidence': round(conf, 3),
                            'helmets': [],
                            'vests': [],
                            'goggles': [],
                            'negatives': []
                        })
                    elif norm_class in ['helmet', 'vest', 'goggles', 'no_helmet', 'no_vest', 'no_goggles']:
                        detected_ppe.append({
                            'norm_class': norm_class,
                            'bbox': bbox,
                            'confidence': round(conf, 3)
                        })

        # If custom model specializes only in PPE, run auxiliary person model to detect workers
        if len(detected_persons) == 0 and self.person_model is not None:
            try:
                p_results = self.person_model.predict(img_bgr, conf=confidence_threshold, verbose=False)
                p_boxes = p_results[0].boxes
                if p_boxes is not None and len(p_boxes) > 0:
                    for box in p_boxes:
                        cls_id = int(box.cls[0].cpu().numpy())
                        raw_name = self.person_model.names.get(cls_id, '')
                        if raw_name.lower() == 'person':
                            xyxy = box.xyxy[0].cpu().numpy().tolist()
                            conf = float(box.conf[0].cpu().numpy())
                            x1, y1, x2, y2 = [int(v) for v in xyxy]
                            x1, y1 = max(0, x1), max(0, y1)
                            x2, y2 = min(w, x2), min(h, y2)
                            detected_persons.append({
                                'id': len(detected_persons) + 1,
                                'bbox': [x1, y1, x2, y2],
                                'confidence': round(conf, 3),
                                'helmets': [],
                                'vests': [],
                                'goggles': [],
                                'negatives': []
                            })
            except Exception as pe:
                print(f"[YOLO] Error running auxiliary person model: {pe}")

        # Fallback: if no full body person was detected but PPE gear/head was detected, treat each head/gear detection as a worker
        if len(detected_persons) == 0 and len(detected_ppe) > 0:
            for item in detected_ppe:
                ibox = item['bbox']
                detected_persons.append({
                    'id': len(detected_persons) + 1,
                    'bbox': ibox,
                    'confidence': item['confidence'],
                    'helmets': [item] if item['norm_class'] == 'helmet' else [],
                    'vests': [item] if item['norm_class'] == 'vest' else [],
                    'goggles': [item] if item['norm_class'] == 'goggles' else [],
                    'negatives': [item] if item['norm_class'] in ['no_helmet', 'no_vest', 'no_goggles'] else []
                })

        # Demonstration mode fallback: if user activated demo mode and no workers were found
        if is_demo_mode and len(detected_persons) == 0:
            dw_w, dw_h = int(w * 0.28), int(h * 0.58)
            dw_x1, dw_y1 = int(w * 0.36), int(h * 0.22)
            detected_persons.append({
                'id': 1,
                'bbox': [dw_x1, dw_y1, dw_x1 + dw_w, dw_y1 + dw_h],
                'confidence': 0.89,
                'helmets': [],
                'vests': [],
                'goggles': [],
                'negatives': []
            })

        # Associate PPE objects with workers based on anatomical bounding sub-regions
        for person in detected_persons:
            px1, py1, px2, py2 = person['bbox']
            pw = px2 - px1
            ph = py2 - py1

            # Define anatomical inspection zones
            head_zone = [px1, py1, px2, int(py1 + 0.40 * ph)]
            torso_zone = [px1, int(py1 + 0.15 * ph), px2, int(py1 + 0.85 * ph)]
            face_zone = [px1, int(py1 + 0.08 * ph), px2, int(py1 + 0.45 * ph)]

            for item in detected_ppe:
                c = item['norm_class']
                ibox = item['bbox']

                if c == 'helmet':
                    if self._boxes_intersect(ibox, head_zone) or self._compute_overlap_ratio(ibox, person['bbox']) > 0.3:
                        person['helmets'].append(item)
                elif c == 'vest':
                    if self._boxes_intersect(ibox, torso_zone) or self._compute_overlap_ratio(ibox, person['bbox']) > 0.3:
                        person['vests'].append(item)
                elif c == 'goggles':
                    if self._boxes_intersect(ibox, face_zone) or self._compute_overlap_ratio(ibox, person['bbox']) > 0.3:
                        person['goggles'].append(item)
                elif c in ['no_helmet', 'no_vest', 'no_goggles']:
                    if self._boxes_intersect(ibox, person['bbox']) or self._boxes_intersect(ibox, head_zone):
                        person['negatives'].append(item)

        # Rule-based PPE compliance evaluation
        violations = []
        persons_with_violations = 0
        require_helmet = rules.get('require_helmet', {}).get('enabled', True)
        require_vest = rules.get('require_vest', {}).get('enabled', True)
        require_goggles = rules.get('require_goggles', {}).get('enabled', False)

        for person in detected_persons:
            p_violations = []
            px1, py1, px2, py2 = person['bbox']
            pw = px2 - px1
            ph = py2 - py1

            # Quality / visibility check
            is_occluded = (pw < 40 or ph < 60)

            # Check explicit negative detections (e.g. NO-Hardhat)
            has_no_helmet = any(n['norm_class'] == 'no_helmet' for n in person['negatives'])
            has_no_vest = any(n['norm_class'] == 'no_vest' for n in person['negatives'])

            if self.is_custom_ppe:
                # Custom model has direct PPE classes
                if (require_helmet and len(person['helmets']) == 0) or has_no_helmet:
                    status = 'Requires Review' if is_occluded else 'Detected'
                    p_violations.append({
                        'type': 'Missing Helmet',
                        'severity': 'High',
                        'confidence': person['confidence'],
                        'audit_status': status,
                        'reason': 'Worker identified without protective safety helmet.'
                    })
                if (require_vest and len(person['vests']) == 0 and ph > 100) or has_no_vest:
                    status = 'Requires Review' if is_occluded else 'Detected'
                    p_violations.append({
                        'type': 'Missing Safety Vest',
                        'severity': 'High',
                        'confidence': person['confidence'],
                        'audit_status': status,
                        'reason': 'No high-visibility safety vest detected on worker torso.'
                    })
                if require_goggles and len(person['goggles']) == 0:
                    status = 'Requires Review' if is_occluded else 'Detected'
                    p_violations.append({
                        'type': 'Missing Safety Goggles',
                        'severity': 'Medium',
                        'confidence': person['confidence'],
                        'audit_status': status,
                        'reason': 'Protective eye equipment missing in required zone.'
                    })
            else:
                # Fallback / General model mode (detects persons reliably)
                # When using base COCO model without PPE weights, we assess workers with demo transparency
                if is_demo_mode or not self.is_custom_ppe:
                    # Provide realistic demonstration assessment
                    worker_id = person['id']
                    # Worker 1: Missing Helmet demo
                    if worker_id % 2 == 1 and require_helmet:
                        p_violations.append({
                            'type': 'Missing Helmet',
                            'severity': 'High',
                            'confidence': round(person['confidence'], 2),
                            'audit_status': 'Requires Review',
                            'reason': 'Safety rule assessment: Headgear not verified by base model (Demonstration Mode).'
                        })
                    # Worker 2: Missing Vest demo
                    elif worker_id % 2 == 0 and require_vest:
                        p_violations.append({
                            'type': 'Missing Safety Vest',
                            'severity': 'High',
                            'confidence': round(person['confidence'], 2),
                            'audit_status': 'Requires Review',
                            'reason': 'Safety rule assessment: Hi-vis vest not verified by base model (Demonstration Mode).'
                        })

            if len(p_violations) > 0:
                persons_with_violations += 1
                for v in p_violations:
                    v['person_id'] = person['id']
                    v['bbox'] = person['bbox']
                    violations.append(v)

        # Draw annotations on annotated_img
        # 1. Draw PPE gear detections
        for item in detected_ppe:
            c = item['norm_class']
            bx1, by1, bx2, by2 = item['bbox']
            if c == 'helmet':
                color = (0, 200, 0) # Green
                label = f"Helmet {item['confidence']}"
            elif c == 'vest':
                color = (255, 170, 0) # Teal/Cyan in BGR
                label = f"Vest {item['confidence']}"
            elif c == 'goggles':
                color = (255, 255, 0) # Cyan
                label = f"Goggles {item['confidence']}"
            else:
                color = (0, 0, 255) # Red for negative labels
                label = f"{c} {item['confidence']}"

            cv2.rectangle(annotated_img, (bx1, by1), (bx2, by2), color, 2)
            cv2.putText(annotated_img, label, (bx1, max(15, by1 - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)

        # 2. Draw Worker bounding boxes and violation highlights
        for person in detected_persons:
            px1, py1, px2, py2 = person['bbox']
            worker_violations = [v for v in violations if v.get('person_id') == person['id']]

            if len(worker_violations) > 0:
                # Violation detected: Red border with Alert badge
                box_color = (0, 0, 220)
                cv2.rectangle(annotated_img, (px1, py1), (px2, py2), box_color, 3)

                violation_summary = worker_violations[0]['type']
                badge_text = f"Worker #{person['id']} - ALERT: {violation_summary}"
                # Background banner for label
                t_size = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
                cv2.rectangle(annotated_img, (px1, max(0, py1 - 24)), (px1 + t_size[0] + 8, py1), box_color, -1)
                cv2.putText(annotated_img, badge_text, (px1 + 4, max(16, py1 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
            else:
                # Safe / Compliant: Blue/Green border
                box_color = (220, 150, 0) # Blue in BGR
                cv2.rectangle(annotated_img, (px1, py1), (px2, py2), box_color, 2)
                badge_text = f"Worker #{person['id']} [Compliant]"
                t_size = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
                cv2.rectangle(annotated_img, (px1, max(0, py1 - 20)), (px1 + t_size[0] + 6, py1), box_color, -1)
                cv2.putText(annotated_img, badge_text, (px1 + 3, max(14, py1 - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # Save violation snapshots
        timestamp_prefix = int(time.time() * 1000)
        for idx, v in enumerate(violations):
            vx1, vy1, vx2, vy2 = v['bbox']
            # Add 15px padding
            sx1 = max(0, vx1 - 15)
            sy1 = max(0, vy1 - 15)
            sx2 = min(w, vx2 + 15)
            sy2 = min(h, vy2 + 15)

            snapshot = img_bgr[sy1:sy2, sx1:sx2]
            snapshot_filename = f"snap_{timestamp_prefix}_{idx}.jpg"
            snapshot_full_path = SNAPSHOT_FOLDER / snapshot_filename

            if snapshot.size > 0:
                cv2.imwrite(str(snapshot_full_path), snapshot)
                v['snapshot_path'] = f"processed/snapshots/{snapshot_filename}"
            else:
                v['snapshot_path'] = None

        # Calculate metrics
        total_persons = len(detected_persons)
        total_violations = len(violations)
        total_ppe_detected = len(detected_ppe)

        if total_persons > 0:
            compliant_workers = max(0, total_persons - persons_with_violations)
            compliance_rate = round((compliant_workers / total_persons) * 100.0, 1)
        else:
            compliance_rate = 100.0

        elapsed_ms = round((time.time() - start_time) * 1000, 1)

        return {
            'annotated_image': annotated_img,
            'total_persons': total_persons,
            'total_ppe_detected': total_ppe_detected,
            'total_violations': total_violations,
            'compliance_rate': compliance_rate,
            'processing_time_ms': elapsed_ms,
            'violations': violations,
            'raw_detections': raw_detections,
            'is_demo': 0 if self.is_custom_ppe else 1
        }

# Global singleton service instance
yolo_service = YOLOSafetyService()
