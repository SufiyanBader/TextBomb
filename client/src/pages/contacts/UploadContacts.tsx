import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const FIELDS = [
  { key: 'phone', label: 'Phone Number', required: true },
  { key: 'first_name', label: 'First Name', required: false },
  { key: 'last_name', label: 'Last Name', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'opt_in', label: 'Opt-In Status', required: false },
  { key: 'opt_in_timestamp', label: 'Opt-In Timestamp', required: false },
];

type Step = 'upload' | 'map' | 'review' | 'done';

export default function UploadContacts() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [listName, setListName] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [importStats, setImportStats] = useState<any>(null);
  const [dragging, setDragging] = useState(false);

  const parseFile = (file: File) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data as any[];
          if (!rows.length) { toast.error('File is empty'); return; }
          setColumns(Object.keys(rows[0]));
          setPreview(rows.slice(0, 5));
          setRawData(rows);
          setListName(file.name.replace(/\.[^.]+$/, ''));
          setStep('map');
        },
        error: () => toast.error('Failed to parse CSV'),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws) as any[];
          if (!rows.length) { toast.error('File is empty'); return; }
          setColumns(Object.keys(rows[0]));
          setPreview(rows.slice(0, 5));
          setRawData(rows);
          setListName(file.name.replace(/\.[^.]+$/, ''));
          setStep('map');
        } catch { toast.error('Failed to parse Excel file'); }
      };
      reader.readAsBinaryString(file);
    }
  };

  const autoDetect = () => {
    const map: Record<string, string> = {};
    columns.forEach(col => {
      const c = col.toLowerCase();
      if (!map.phone && (c.includes('phone') || c.includes('mobile') || c.includes('whatsapp'))) map.phone = col;
      if (!map.first_name && (c.includes('first') || c === 'fname')) map.first_name = col;
      if (!map.last_name && (c.includes('last') || c === 'lname')) map.last_name = col;
      if (!map.email && c.includes('email')) map.email = col;
      if (!map.company && (c.includes('company') || c.includes('org'))) map.company = col;
      if (!map.opt_in && (c.includes('opt') || c.includes('subscri') || c.includes('consent'))) map.opt_in = col;
    });
    setColumnMap(map);
    toast.success('Auto-detected columns');
  };

  const doImport = async () => {
    if (!columnMap.phone) { toast.error('Phone number column is required'); return; }
    if (!listName.trim()) { toast.error('List name is required'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/contacts/lists/import', { list_name: listName, rows: rawData, column_map: columnMap });
      setImportStats(data.stats);
      setStep('done');
      toast.success('Import complete!');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Import failed'); }
    finally { setLoading(false); }
  };

  const stepIdx = ['upload', 'map', 'review', 'done'].indexOf(step);

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="sec-h">
        <div><div className="sec-t">Upload Contacts</div><div className="sec-s">Import contacts from Excel or CSV</div></div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {(['upload', 'map', 'review', 'done'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < stepIdx ? 'var(--teal)' : i === stepIdx ? '#fff' : 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: i <= stepIdx ? '#000' : 'var(--tx4)', transition: 'all .3s' }}>
                {i < stepIdx ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: i === stepIdx ? 600 : 400, color: i === stepIdx ? 'var(--tx1)' : 'var(--tx4)', textTransform: 'capitalize' }}>{s}</span>
            </div>
            {i < 3 && <div style={{ flex: 1, height: 1, background: i < stepIdx ? 'var(--teal)' : 'var(--bdr)', maxWidth: 40, transition: 'background .3s' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="card">
          <div className="card-b">
            <div className="fg">
              <label className="fl">List Name *</label>
              <input className="fi" placeholder="e.g. July Newsletter Subscribers" value={listName} onChange={e => setListName(e.target.value)} />
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
              onClick={() => document.getElementById('file-input')?.click()}
              style={{ border: `2px dashed ${dragging ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.15)'}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.02)', transition: 'all .2s', marginBottom: 14 }}>
              <div style={{ fontSize: '2rem', marginBottom: 10, opacity: .6 }}>📂</div>
              <div style={{ fontWeight: 700, marginBottom: 5, fontSize: '0.95rem' }}>{dragging ? 'Drop here…' : 'Drop file or click to browse'}</div>
              <div className="muted">Supports .xlsx, .xls, .csv — Max 10MB</div>
              <input id="file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} />
            </div>
            <div className="ibox ib" style={{ marginBottom: 0, fontSize: '0.78rem' }}>
              <strong style={{ color: 'var(--teal)' }}>Required:</strong> Phone number and opt-in status columns. Contacts without opt-in are imported but excluded from campaigns.
            </div>
          </div>
        </div>
      )}

      {/* Step: Map */}
      {step === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-h">
              <div><div className="card-t">Map Columns</div><div className="card-sub">{fileName} · {rawData.length.toLocaleString()} rows</div></div>
              <button className="btn bs bsm" onClick={autoDetect}>✨ Auto-detect</button>
            </div>
            <div className="card-b">
              <div className="fg">
                <label className="fl">List Name *</label>
                <input className="fi" value={listName} onChange={e => setListName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {FIELDS.map(({ key, label, required }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 160, flexShrink: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--tx2)' }}>
                      {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
                    </div>
                    <select className="fi" value={columnMap[key] || ''} onChange={e => setColumnMap(m => ({ ...m, [key]: e.target.value }))}>
                      <option value="">— Not mapped —</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {columnMap[key] && <span style={{ color: 'var(--green)', fontSize: '0.72rem', flexShrink: 0 }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="card-h"><div className="card-t">Preview (first 5 rows)</div></div>
            <div className="twrap" style={{ fontSize: '0.78rem' }}>
              <table className="tbl">
                <thead><tr>{columns.slice(0, 5).map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>{columns.slice(0, 5).map(c => <td key={c} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(row[c] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn bs" onClick={() => setStep('upload')}>← Back</button>
            <button className="btn bp" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { if (!columnMap.phone) { toast.error('Phone column required'); return; } setStep('review'); }}>
              Review Import →
            </button>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-h"><div className="card-t">Ready to Import</div></div>
            <div className="card-b">
              <div className="g2" style={{ marginBottom: 16 }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px', textAlign: 'center', border: '1px solid var(--bdr)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Manrope,sans-serif' }}>{rawData.length.toLocaleString()}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>Total Rows</div>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px', textAlign: 'center', border: '1px solid var(--bdr)' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Manrope,sans-serif', color: 'var(--teal)' }}>{Object.values(columnMap).filter(Boolean).length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>Mapped Fields</div>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                {FIELDS.filter(f => columnMap[f.key]).map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: '0.85rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--tx4)', width: 130 }}>{label}</span>
                    <span style={{ color: 'var(--teal)' }}>→</span>
                    <span style={{ fontWeight: 600 }}>{columnMap[key]}</span>
                  </div>
                ))}
              </div>
              <div className="ibox iy" style={{ marginBottom: 0, fontSize: '0.78rem' }}>
                ⚠️ Contacts without opt-in status will be imported but blocked from campaigns until opt-in is confirmed.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn bs" onClick={() => setStep('map')}>← Back</button>
            <button className="btn bp" style={{ flex: 1, justifyContent: 'center' }} onClick={doImport} disabled={loading}>
              {loading ? '⟳ Importing…' : `Import ${rawData.length.toLocaleString()} Contacts`}
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && importStats && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.3rem', marginBottom: 6 }}>Import Complete!</h2>
          <p style={{ color: 'var(--tx4)', marginBottom: 24 }}>"{listName}" is ready to use in campaigns.</p>
          <div className="g4" style={{ marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>
            {[
              { label: 'Processed', value: importStats.total, color: 'var(--tx1)' },
              { label: 'Imported', value: importStats.valid, color: 'var(--green)' },
              { label: 'No Opt-In', value: importStats.no_optin, color: 'var(--yellow)' },
              { label: 'Invalid', value: importStats.invalid + importStats.duplicates, color: 'var(--red)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 8px', border: '1px solid var(--bdr)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color, fontFamily: 'Manrope,sans-serif' }}>{value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn bs" onClick={() => { setStep('upload'); setRawData([]); setColumnMap({}); }}>Upload Another</button>
            <button className="btn bp" onClick={() => navigate('/contacts')}>View Lists →</button>
          </div>
        </div>
      )}
    </div>
  );
}
