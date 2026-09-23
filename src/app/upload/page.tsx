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
  accountName: string;
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
  count?: number;
  cardName?: string | null;
  reconciliation?: { status: string; difference: number | null; possible_overlap_count?: number };
}

export default function UploadPage() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = jobs.some(job => job.status === 'uploading');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newJobs: UploadJob[] = Array.from(files)
      .filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
      .map((file) => ({ file, source: "savings", password: "", accountName: "", status: "idle" }));
    setJobs((prev) => [...prev, ...newJobs]);
  };

  const updateJob = (idx: number, patch: Partial<UploadJob>) =>
    setJobs((prev) => prev.map((j, i) => (i === idx ? { ...j, ...patch } : j)));

  const removeJob = (idx: number) =>
    setJobs((prev) => prev.filter((_, i) => i !== idx));

  const uploadJob = async (idx: number) => {
    const job = jobs[idx];
    if (!job.accountName.trim()) {
      updateJob(idx, { status: 'error', message: 'Enter an account label before uploading.' });
      return;
    }
    updateJob(idx, { status: "uploading" });

    const fd = new FormData();
    fd.append("file", job.file);
    fd.append("source", job.source);
    fd.append("account_name", job.accountName.trim());
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
          reconciliation: data.reconciliation,
        });
      } else {
        updateJob(idx, { status: "error", message: data.error ?? "Upload failed" });
      }
    } catch {
      updateJob(idx, { status: "error", message: "Network error. Please try again." });
    }
  };

  const uploadAll = async () => {
    const pendingIndices = jobs
      .map((job, index) => (job.status === "idle" ? index : -1))
      .filter((index) => index >= 0);
    for (const index of pendingIndices) await uploadJob(index);
  };

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
        <h3>Drag &amp; drop PDF statements here (up to 4.45 MB)</h3>
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
              <button className="btn btn-primary btn-sm" onClick={uploadAll} disabled={busy}>
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
                      disabled={busy}
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
                {(job.status === "idle" || job.status === "error") && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <input className="input" aria-label="Account label" placeholder="Account label, e.g. HDFC salary 8921" maxLength={120} value={job.accountName} disabled={busy} onChange={e => updateJob(idx, { accountName: e.target.value })} />
                    <p style={{ fontSize: '0.8rem' }}>Use the same label for future statements from this account; use different labels for different accounts.</p>
                    <select
                      value={job.source}
                      onChange={(e) => updateJob(idx, { source: e.target.value as Source })}
                      className="input"
                      disabled={busy}
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
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => uploadJob(idx)}>
                      {job.status === 'error' ? 'Retry' : 'Upload'}
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
                    <p style={{ color: 'var(--text-primary)', marginTop: 8 }}>
                      {job.reconciliation?.status === 'matched' ? 'Extracted balances reconcile. This does not verify categorization or guarantee every row is correct.' : job.reconciliation?.status === 'mismatch' ? `Review needed: extracted balances differ by ₹${Math.abs(job.reconciliation.difference ?? 0).toFixed(2)}. Transactions were saved; compare them with your statement.` : 'Balance reconciliation unverified: usable statement balances were missing or conflicting.'}
                    </p>
                    {!!job.reconciliation?.possible_overlap_count && <p style={{ color: 'var(--text-primary)' }}>{job.reconciliation.possible_overlap_count} rows resemble existing transactions in this account. Review possible overlapping statements; no rows were automatically removed.</p>}
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
            { step: "02", title: "AI Parsing", desc: "Groq Qwen detects the card name, extracts transactions and categorizes them." },
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
