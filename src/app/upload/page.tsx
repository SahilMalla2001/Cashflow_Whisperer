"use client";
import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader } from "lucide-react";

type Source = "savings" | "credit";

const SOURCE_OPTIONS: { value: Source; label: string; hint: string }[] = [
  { value: "savings", label: "Savings / Bank Account", hint: "Salary credits, UPI, bank transfers" },
  { value: "credit", label: "Credit Card", hint: "Any card — we'll detect the card name from the PDF" },
];

interface UploadJob {
  file: File;
  source: Source;
  password: string;
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
  count?: number;
  cardName?: string | null;
}

export default function UploadPage() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newJobs: UploadJob[] = Array.from(files)
      .filter((f) => f.type === "application/pdf")
      .map((file) => ({ file, source: "savings", password: "", status: "idle" }));
    setJobs((prev) => [...prev, ...newJobs]);
  };

  const updateJob = (idx: number, patch: Partial<UploadJob>) =>
    setJobs((prev) => prev.map((j, i) => (i === idx ? { ...j, ...patch } : j)));

  const removeJob = (idx: number) =>
    setJobs((prev) => prev.filter((_, i) => i !== idx));

  const uploadJob = async (idx: number) => {
    const job = jobs[idx];
    updateJob(idx, { status: "uploading" });

    const fd = new FormData();
    fd.append("file", job.file);
    fd.append("source", job.source);
    if (job.password) fd.append("password", job.password);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        updateJob(idx, {
          status: "success",
          message: data.message,
          count: data.count,
          cardName: data.card_name,
        });
      } else {
        updateJob(idx, { status: "error", message: data.error ?? "Upload failed" });
      }
    } catch {
      updateJob(idx, { status: "error", message: "Network error. Please try again." });
    }
  };

  const uploadAll = () =>
    jobs.forEach((j, i) => { if (j.status === "idle") uploadJob(i); });

  const pendingCount = jobs.filter((j) => j.status === "idle").length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Upload Statements</h1>
          <p>Drop your bank or credit card PDFs — we&apos;ll extract &amp; categorize everything automatically</p>
        </div>
      </div>

      {/* Source type cards */}
      <div className="grid-2 section" style={{ marginBottom: "24px" }}>
        {SOURCE_OPTIONS.map((opt) => (
          <div key={opt.value} className="card" style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "8px",
              background: "var(--bg-secondary)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <FileText size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "4px" }}>{opt.label}</div>
              <div style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>{opt.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={`upload-zone ${dragging ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={40} className="upload-zone-icon" />
        <h3>Drag &amp; drop PDF statements here</h3>
        <p>or click to browse · Supports password-protected PDFs · Card name auto-detected</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          style={{ display: "none" }}
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* Job queue */}
      {jobs.length > 0 && (
        <div className="section" style={{ marginTop: "24px" }}>
          <div className="section-header">
            <div className="section-title">
              <FileText size={14} />
              {jobs.length} file{jobs.length !== 1 ? "s" : ""} queued
            </div>
            {pendingCount > 0 && (
              <button className="btn btn-primary btn-sm" onClick={uploadAll}>
                Upload All ({pendingCount})
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {jobs.map((job, idx) => (
              <div key={idx} className="card card-sm" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                    <FileText size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{
                      fontSize: "0.875rem", fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {job.file.name}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }}>
                      {(job.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  {job.status === "idle" && (
                    <button
                      onClick={() => removeJob(idx)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", flexShrink: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {job.status === "success" && <CheckCircle size={16} style={{ color: "var(--positive)", flexShrink: 0 }} />}
                  {job.status === "error" && <AlertCircle size={16} style={{ color: "var(--negative)", flexShrink: 0 }} />}
                  {job.status === "uploading" && <div className="spinner" style={{ flexShrink: 0 }} />}
                </div>

                {/* Config (only when idle) */}
                {job.status === "idle" && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <select
                      value={job.source}
                      onChange={(e) => updateJob(idx, { source: e.target.value as Source })}
                      className="input"
                      style={{ maxWidth: "240px" }}
                    >
                      {SOURCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      type="password"
                      placeholder="PDF password (if any)"
                      value={job.password}
                      onChange={(e) => updateJob(idx, { password: e.target.value })}
                      className="input"
                      style={{ maxWidth: "200px" }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => uploadJob(idx)}>
                      Upload
                    </button>
                  </div>
                )}

                {/* Success */}
                {job.status === "success" && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--positive)" }}>
                    ✓ {job.count} transactions imported
                    {job.cardName && (
                      <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
                        · Detected: <strong style={{ color: "var(--text-primary)" }}>{job.cardName}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Error */}
                {job.status === "error" && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--negative)" }}>
                    ✗ {job.message}
                  </div>
                )}

                {/* Processing */}
                {job.status === "uploading" && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Loader size={12} style={{ animation: "spin 1s linear infinite" }} />
                    Extracting text → Detecting card → Parsing with AI → Saving…
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="section" style={{ marginTop: "32px" }}>
        <div className="section-title" style={{ marginBottom: "14px" }}>How it works</div>
        <div className="grid-3">
          {[
            { step: "01", title: "Upload PDF", desc: "Drop your bank or credit card statement. Password-protected PDFs are supported." },
            { step: "02", title: "AI Parsing", desc: "Groq LLM (Llama 3) detects the card name, extracts every transaction and categorizes it." },
            { step: "03", title: "Instant Dashboard", desc: "Your dashboard and credit card pages update automatically — new cards appear dynamically." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="card">
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: "10px" }}>
                STEP {step}
              </div>
              <h4 style={{ marginBottom: "6px" }}>{title}</h4>
              <p style={{ fontSize: "0.8125rem" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
