import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Camera,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  Clock,
  MapPin,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import api from '../services/api';
import { Link } from 'react-router-dom';

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! I am **SafeSight AI Assistant** (VisionDesk Agent). I combine real-time YOLOv8 visual detection intelligence with our ChromaDB safety document knowledge base to deliver context-grounded, audit-ready safety answers.\n\nAsk me about recent zone alerts, worker PPE compliance, safety manual policies, or incident summaries.",
      steps: [],
      visualEvidence: [],
      documentSources: [],
      incident: null,
      alert: null,
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [expandedSteps, setExpandedSteps] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    api.getSuggestedQuestions()
      .then(res => setSuggestions(res.suggestions || []))
      .catch(() => setSuggestions([
        "Why was there a safety violation alert in Zone A?",
        "Which worker was detected without a helmet?",
        "What does the safety manual say about helmet requirements?",
        "Are the detected PPE violations against company safety policy?",
        "What safety actions should the supervisor take?",
        "Summarize today's safety incidents.",
      ]));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleSteps = (msgId) => {
    setExpandedSteps(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async (questionText = null) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.askAgent(q);

      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: response.answer || "No response generated.",
        steps: response.steps_log || [],
        visualEvidence: response.visual_evidence || [],
        documentSources: response.document_sources || [],
        incident: response.incident || null,
        alert: response.alert || null,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **Error coordinating safety agent:** ${err.message || 'Unable to retrieve answer.'}`,
          steps: [{ node: 'Agent Execution Error', status: 'error', detail: err.message }],
          visualEvidence: [],
          documentSources: [],
          incident: null,
          alert: null,
          timestamp: new Date().toLocaleTimeString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: '16px' }}>
      {/* Top Banner / System State */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
          }}>
            <Bot size={24} color="#f8fafc" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              VisionDesk Agent
              <span style={{ fontSize: '0.72rem', background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                Milestone 3 RAG
              </span>
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Multimodal Safety Intelligence: YOLOv8 Detections + ChromaDB Knowledge Retrieval
            </p>
          </div>
        </div>

        {/* Engine Pipeline Status Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid #334155', padding: '4px 10px', borderRadius: '8px', fontSize: '0.76rem', color: '#38bdf8' }}>
            <Layers size={13} />
            <span>LangGraph 8-Node Flow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid #334155', padding: '4px 10px', borderRadius: '8px', fontSize: '0.76rem', color: '#4ade80' }}>
            <CheckCircle2 size={13} />
            <span>ChromaDB Synced</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid #334155', padding: '4px 10px', borderRadius: '8px', fontSize: '0.76rem', color: '#f59e0b' }}>
            <Camera size={13} />
            <span>YOLOv8 Active</span>
          </div>
        </div>
      </div>

      {/* Main Chat Stream */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: '#0b1120',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: msg.role === 'user' ? '75%' : '88%',
              gap: '6px'
            }}
          >
            {/* Sender & Timestamp */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: '#64748b',
              padding: '0 4px',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              {msg.role === 'user' ? (
                <span>You</span>
              ) : (
                <span style={{ color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={12} /> SafeSight AI Assistant
                </span>
              )}
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* Bubble */}
            <div style={{
              background: msg.role === 'user' ? '#0369a1' : '#1e293b',
              color: '#f8fafc',
              border: msg.role === 'user' ? '1px solid #0284c7' : '1px solid #334155',
              borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
              padding: '14px 18px',
              lineHeight: 1.6,
              fontSize: '0.92rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              whiteSpace: 'pre-line'
            }}>
              {msg.text}

              {/* Incidents / Alerts Notification Pills */}
              {(msg.incident || msg.alert) && (
                <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {msg.incident && (
                    <Link
                      to="/incidents"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#fca5a5',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        textDecoration: 'none',
                        fontWeight: 600
                      }}
                    >
                      <AlertTriangle size={13} />
                      <span>Incident Logged: {msg.incident.code}</span>
                      <ExternalLink size={11} />
                    </Link>
                  )}
                  {msg.alert && (
                    <Link
                      to="/alerts"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#fcd34d',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        textDecoration: 'none',
                        fontWeight: 600
                      }}
                    >
                      <BellRing size={13} />
                      <span>In-App Alert: {msg.alert.code}</span>
                      <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Agent Workflow Stepper */}
            {msg.steps && msg.steps.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <button
                  onClick={() => toggleSteps(msg.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 4px'
                  }}
                >
                  <Cpu size={12} color="#38bdf8" />
                  <span>Agent Execution Trace ({msg.steps.length} nodes)</span>
                  {expandedSteps[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {expandedSteps[msg.id] && (
                  <div style={{
                    marginTop: '6px',
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {msg.steps.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.76rem' }}>
                        <span style={{
                          color: '#38bdf8',
                          fontWeight: 700,
                          minWidth: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'rgba(56, 189, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.68rem'
                        }}>
                          {idx + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{step.node}: </span>
                          <span style={{ color: '#94a3b8' }}>{step.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Visual Evidence Cards */}
            {msg.visualEvidence && msg.visualEvidence.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Camera size={13} />
                  <span>Visual Detection Evidence ({msg.visualEvidence.length} records)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                  {msg.visualEvidence.map((v, idx) => (
                    <div key={idx} style={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{v.violation_type}</span>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: v.severity === 'High' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: v.severity === 'High' ? '#ef4444' : '#f59e0b',
                          fontWeight: 700
                        }}>
                          {v.severity} ({intConf(v.confidence)}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                        <Camera size={11} /> <span>{v.camera_id}</span>
                        <span>•</span>
                        <MapPin size={11} /> <span>{v.zone}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.72rem' }}>
                        <Clock size={11} /> <span>{v.timestamp}</span>
                      </div>
                      {v.notes && (
                        <div style={{ color: '#cbd5e1', fontSize: '0.72rem', fontStyle: 'italic', marginTop: '2px' }}>
                          "{v.notes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document Sources Cards */}
            {msg.documentSources && msg.documentSources.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4ade80', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={13} />
                  <span>Retrieved Safety Document Sources ({msg.documentSources.length} citations)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                  {msg.documentSources.map((doc, idx) => (
                    <div key={idx} style={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.filename}
                        </span>
                        <span style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                          Page {doc.page}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        "{doc.text}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator with Step Progress */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'flex-start', maxWidth: '75%' }}>
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '14px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#38bdf8',
              fontSize: '0.88rem'
            }}>
              <RefreshCw size={18} className="animate-spin" />
              <div>
                <div style={{ fontWeight: 600, color: '#f8fafc' }}>LangGraph Orchestrating Multimodal RAG...</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Analyzing query intent • Retrieving YOLO detections • Querying ChromaDB • Fusing evidence</div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {suggestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0284c7';
                e.currentTarget.style.color = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#334155';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              <Sparkles size={11} color="#38bdf8" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about zone safety alerts, helmet requirements, or worker PPE compliance..."
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#f8fafc',
            fontSize: '0.92rem',
            resize: 'none',
            outline: 'none',
            padding: '6px 4px',
            fontFamily: 'inherit'
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          style={{
            background: input.trim() && !loading ? '#0284c7' : '#334155',
            color: '#f8fafc',
            border: 'none',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s ease',
            flexShrink: 0
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function intConf(conf) {
  if (conf === undefined || conf === null) return 85;
  const num = typeof conf === 'number' ? conf : parseFloat(conf);
  return isNaN(num) ? 85 : Math.round(num > 1 ? num : num * 100);
}
