import React, { useState, useRef, useEffect } from 'react';
import {
  Cctv,
  Camera,
  Play,
  Square,
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  Activity,
  Layers,
  Radio,
  Video,
  Info
} from 'lucide-react';
import api from '../services/api';

export default function LiveMonitorPage() {
  const [selectedChannel, setSelectedChannel] = useState(1);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState(null);
  const [webcamAnalyzing, setWebcamAnalyzing] = useState(false);
  const [webcamResult, setWebcamResult] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  const cctvChannels = [
    { id: 1, name: 'CAM-01: Main Assembly Line', zone: 'Sector A-3', status: 'Simulated Stream', fps: 30, resolution: '1080p' },
    { id: 2, name: 'CAM-02: Heavy Fabrication Bay', zone: 'Sector B-1', status: 'Simulated Stream', fps: 25, resolution: '1080p' },
    { id: 3, name: 'CAM-03: Loading & Logistics Gate', zone: 'Sector D-2', status: 'Simulated Stream', fps: 30, resolution: '720p' },
  ];

  const recentIncidents = [
    { id: 1, time: '14:28:12', cam: 'CAM-01', text: 'Worker #3: Missing Hard Hat', severity: 'High' },
    { id: 2, time: '14:27:45', cam: 'CAM-02', text: 'Worker #1: Missing Hi-Vis Vest', severity: 'High' },
    { id: 3, time: '14:25:03', cam: 'CAM-01', text: 'Worker #5: Protective Goggles Required', severity: 'Medium' },
    { id: 4, time: '14:22:19', cam: 'CAM-03', text: 'Worker #2: Missing Hard Hat', severity: 'High' },
  ];

  // Start local webcam demo
  const startWebcam = async () => {
    setWebcamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsWebcamActive(true);

      // Start periodic frame capture and YOLO inference every 4 seconds
      intervalRef.current = setInterval(captureAndAnalyzeFrame, 4000);
    } catch (err) {
      console.error("Webcam error:", err);
      setWebcamError("Camera access denied or no webcam found. Please allow camera permissions in your browser.");
      setIsWebcamActive(false);
    }
  };

  // Stop local webcam
  const stopWebcam = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setWebcamAnalyzing(false);
  };

  // Capture frame from webcam and send to backend
  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== 4) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setWebcamAnalyzing(true);
      const formData = new FormData();
      formData.append('file', blob, 'webcam_frame.jpg');
      formData.append('confidence', 0.40);
      formData.append('require_helmet', true);
      formData.append('require_vest', true);
      formData.append('demo_mode', true);

      try {
        const res = await api.analyzeImage(formData);
        setWebcamResult(res);
      } catch (err) {
        console.warn("Live frame inference warning:", err);
      } finally {
        setWebcamAnalyzing(false);
      }
    }, 'image/jpeg', 0.85);
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div>
      {/* Header and Mode Disclaimer */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Live CCTV & Video Monitor</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Multi-channel industrial feed simulation and interactive local webcam safety inspection.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {!isWebcamActive ? (
              <button onClick={startWebcam} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                <Camera size={16} />
                Activate Local Webcam Demo
              </button>
            ) : (
              <button onClick={stopWebcam} className="btn btn-secondary" style={{ fontSize: '0.85rem', color: 'var(--red)' }}>
                <Square size={16} />
                Stop Webcam Demo
              </button>
            )}
          </div>
        </div>

        {/* Demo Mode Notice */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#1e40af',
          fontSize: '0.85rem'
        }}>
          <Info size={18} color="#2563eb" />
          <span>
            <b>Demonstration Notice:</b> CCTV channels displayed below represent industrial workplace camera simulation. To test live camera input, click <b>Activate Local Webcam Demo</b> to process your local camera feed with backend YOLOv8.
          </span>
        </div>

        {webcamError && (
          <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            backgroundColor: 'var(--red-light)',
            color: 'var(--red)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #fecaca',
            fontSize: '0.85rem'
          }}>
            {webcamError}
          </div>
        )}
      </div>

      {/* Main Focal Display + Incident Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '20px', marginBottom: '24px' }}>
        {/* Focal Video Stream Area */}
        <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
              <Radio size={16} color="var(--red)" className="spin-animation" />
              {isWebcamActive ? 'Active Local Webcam Inspection Feed' : cctvChannels.find(c => c.id === selectedChannel)?.name}
            </h3>
            <span className="badge badge-high" style={{ fontSize: '0.7rem' }}>
              {isWebcamActive ? (webcamAnalyzing ? 'INFERENCE ACTIVE' : 'LIVE DEMO') : 'SIMULATED CCTV'}
            </span>
          </div>

          <div style={{
            height: '420px',
            backgroundColor: '#020617',
            borderRadius: 'var(--radius-sm)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isWebcamActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                {webcamResult && (
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    right: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(4px)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>Workers: <b>{webcamResult.total_persons}</b></span>
                    <span>PPE Items: <b>{webcamResult.total_ppe_detected}</b></span>
                    <span style={{ color: webcamResult.total_violations > 0 ? '#ef4444' : '#10b981' }}>
                      Violations: <b>{webcamResult.total_violations}</b>
                    </span>
                    <span>Compliance: <b>{webcamResult.compliance_rate}%</b></span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Simulated CCTV Background */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle, rgba(15,23,42,1) 0%, rgba(2,6,23,1) 100%)',
                  opacity: 0.95
                }} />

                {/* Industrial grid scan line */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)',
                  backgroundSize: '30px 30px'
                }} />

                {/* Simulated CCTV Overlay Details */}
                <div className="cctv-overlay-info">
                  <span>{cctvChannels.find(c => c.id === selectedChannel)?.name}</span>
                  <span>LIVE • {new Date().toLocaleTimeString()}</span>
                </div>

                <div style={{ position: 'relative', textAlign: 'center', color: '#94a3b8', zIndex: 10 }}>
                  <Cctv size={48} color="#38bdf8" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                    Industrial CCTV Stream Active
                  </div>
                  <div style={{ fontSize: '0.82rem', maxWidth: '380px', marginTop: '6px' }}>
                    High-definition video feed connected. Computer vision model actively scanning work area for safety violations.
                  </div>
                </div>

                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: '#38bdf8',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace'
                }}>
                  ZONE: {cctvChannels.find(c => c.id === selectedChannel)?.zone} • ENCODING: H.264
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Incident Stream Sidebar */}
        <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
              <AlertTriangle size={16} color="var(--orange)" />
              Real-Time Incident Stream
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-refreshing</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentIncidents.map((inc) => (
              <div key={inc.id} style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.82rem'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inc.text}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {inc.cam} • {inc.time}
                  </div>
                </div>
                <span className="badge badge-high" style={{ fontSize: '0.68rem' }}>
                  {inc.severity}
                </span>
              </div>
            ))}
          </div>

          {/* RTSP Architecture Note */}
          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.76rem',
            color: 'var(--text-secondary)'
          }}>
            <b>NVR / RTSP Integration Architecture:</b><br />
            SafeSight AI video ingestion pipeline is structured to accept RTSP camera URIs (e.g. <code>rtsp://admin:pass@ip:554/stream1</code>) via OpenCV VideoCapture worker threads.
          </div>
        </div>
      </div>

      {/* Three CCTV Channel Cards Grid */}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>
        Active Industrial Channels
      </h3>

      <div className="cctv-grid">
        {cctvChannels.map((chan) => (
          <div
            key={chan.id}
            className="cctv-card"
            style={{
              cursor: 'pointer',
              borderColor: selectedChannel === chan.id ? 'var(--primary)' : '#1e293b',
              boxShadow: selectedChannel === chan.id ? '0 0 0 2px var(--primary)' : 'none'
            }}
            onClick={() => setSelectedChannel(chan.id)}
          >
            <div className="cctv-screen">
              <div className="cctv-overlay-info">
                <span>{chan.name.split(':')[0]}</span>
                <span>{chan.fps} FPS • {chan.resolution}</span>
              </div>
              <Cctv size={36} color="#38bdf8" />
              <div style={{ position: 'absolute', bottom: '8px', right: '10px', fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                {chan.zone}
              </div>
            </div>
            <div className="cctv-footer">
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{chan.name}</span>
              <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="status-dot" /> {chan.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
