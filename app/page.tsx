// app/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
// removed top-level supabase import to avoid import-time throws in build
// lazy-load browser supabase below when needed

type Hospital = {
  id: string;
  name?: string | null;
  city?: string | null;
  website?: string | null;
  telemedicine?: boolean | null;
  emails?: string[] | null;
  phones?: string[] | null;
  address?: string | null;
  status?: string | null;
  cold_emailed?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
};

/* ---------------------- Small Toast system ---------------------- */
type ToastMsg = { id: string; type: 'success' | 'error' | 'info'; text: string };

function useToasts(ttl = 3500) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = (t: Omit<ToastMsg, 'id'>) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 7);
    setToasts((s) => [...s, { ...t, id }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), ttl);
  };
  const clear = () => setToasts([]);
  return { toasts, push, clear };
}

function Toasts({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed z-50 right-4 bottom-4 max-w-sm w-full sm:right-6 sm:bottom-6">
      <div className="flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`rounded-lg px-4 py-3 shadow-md border ${
              t.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="text-sm">{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------- Small Dropdown (keeps your previous behavior) ---------------------- */
function Dropdown<T extends string | number | null>(props: {
  label?: string;
  items: { value: T; label: string }[];
  selected?: T;
  onSelect: (v: T) => void;
  className?: string;
}) {
  const { items, onSelect, selected, label, className } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white shadow-sm text-sm font-medium ${className ?? ''}`}
      >
        {label ?? (selected ? String(selected) : 'Select')}
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5.23 7.21a.75.75 0 011.06-.02L10 10.83l3.71-3.64a.75.75 0 011.04 1.08l-4.25 4.17a.75.75 0 01-1.04 0L5.25 8.27a.75.75 0 01-.02-1.06z" />
        </svg>
      </button>

      {open && (
        <div role="menu" aria-orientation="vertical" className="absolute right-0 mt-2 w-44 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {items.map((it) => (
              <button
                key={String(it.value)}
                onClick={() => {
                  onSelect(it.value);
                  setOpen(false);
                }}
                role="menuitem"
                className={`w-full text-left px-3 py-2 text-sm ${selected === it.value ? 'font-semibold bg-emerald-50' : 'hover:bg-slate-100'}`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------- supabase lazy loader ---------------------- */
/**
 * Lazy-load the browser supabase client so we never import it at module-load time.
 * This prevents build-time / server-side import problems.
 */
const _supabaseRef: { current: any | null } = { current: null };
async function getSupabase() {
  if (_supabaseRef.current) return _supabaseRef.current;
  // dynamic import so bundlers know this is browser-only usage
  const mod = await import('@/lib/supabase-browser');
  _supabaseRef.current = mod.getSupabaseBrowser();
  return _supabaseRef.current;
}

/* ---------------------- Main Page ---------------------- */
export default function Page() {
  const [rows, setRows] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('All cities');
  const [status, setStatus] = useState('All statuses');
  const [sortKey, setSortKey] = useState<'name' | 'created_at'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [hasColdEmailedColumn, setHasColdEmailedColumn] = useState(false);

  const { toasts, push } = useToasts(3400);
  const channelRef = useRef<any | null>(null);

  // fetch rows (safe select *)
  const fetchRows = async () => {
    setLoading(true);
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from('hospitals').select('*').order('name', { ascending: true });
      if (error) {
        console.error('Supabase fetch error', error);
        push({ type: 'error', text: `Failed to fetch rows: ${error.message ?? 'unknown'}` });
      } else {
        const fetched = (data as Hospital[]) || [];
        setRows(fetched);
        setHasColdEmailedColumn(fetched.some((r) => Object.prototype.hasOwnProperty.call(r, 'cold_emailed')));
      }
    } catch (err) {
      console.error('Fetch error', err);
      push({ type: 'error', text: 'Failed to fetch rows. See console.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load rows and subscribe to realtime changes (browser only)
    let mounted = true;

    (async () => {
      await fetchRows();

      try {
        const supabase = await getSupabase();
        // create a realtime channel (API may differ by client version)
        try {
          const channel = supabase
            .channel('realtime-hospitals')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hospitals' }, () => {
              // refresh on any change
              fetchRows();
            })
            .subscribe();
          channelRef.current = channel;
        } catch (e) {
          // older/newer supabase-js versions differ; try fallback
          if (typeof supabase.from === 'function') {
            // fallback to legacy realtime (best-effort)
            try {
              const sub = supabase.from('hospitals').on('*', () => fetchRows()).subscribe();
              channelRef.current = sub;
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        // ignore subscription errors for now
        console.warn('Realtime subscribe failed', e);
      }
    })();

    return () => {
      mounted = false;
      // cleanup realtime
      try {
        const supabase = _supabaseRef.current;
        if (channelRef.current) {
          try {
            if (typeof channelRef.current.unsubscribe === 'function') channelRef.current.unsubscribe();
            else if (supabase && typeof supabase.removeChannel === 'function') supabase.removeChannel(channelRef.current);
          } catch (e) {
            console.warn('Error cleaning realtime channel', e);
          }
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived lists
  const cities = useMemo(() => {
    const set = new Set(rows.map((r) => (r.city || '').trim()).filter(Boolean));
    return ['All cities', ...Array.from(set).sort()];
  }, [rows]);

  const statuses = useMemo(() => {
    const set = new Set(rows.map((r) => (r.status || '').trim()).filter(Boolean));
    return ['All statuses', ...Array.from(set).sort()];
  }, [rows]);

  // filtered list
  const filtered = useMemo(() => {
    let out = rows.filter((r) => {
      const hay = `${r.name || ''} ${r.city ?? ''} ${(Array.isArray(r.emails) ? r.emails : []).join(' ')} ${
        Array.isArray(r.phones) ? r.phones.join(' ') : ''
      } ${r.address ?? ''}`.toLowerCase();

      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false;
      if (city !== 'All cities' && (r.city ?? '') !== city) return false;
      if (status !== 'All statuses' && (r.status ?? '') !== status) return false;

      return true;
    });

    out = out.sort((a, b) => {
      const d = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return d * ((a.name ?? '').localeCompare(b.name ?? ''));
      if (sortKey === 'created_at') return d * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
      return 0;
    });

    return out;
  }, [rows, q, city, status, sortKey, sortDir]);

  // totals (cold-emailed is 0 if column missing)
  const totals = useMemo(() => {
    const total = rows.length;
    const closed = rows.filter((r) => r.status === 'closed' || r.status === 'reached').length;
    const open = total - closed;
    const telemed = rows.filter((r) => r.telemedicine === true).length;
    const emailed = hasColdEmailedColumn ? rows.filter((r) => r.cold_emailed === true).length : 0;
    return { total, closed, open, telemed, emailed };
  }, [rows, hasColdEmailedColumn]);

  const toggleSelection = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  // toggle status (closed/new) for single row
  const toggleStatus = async (id: string, currentStatus?: string | null) => {
    const isClosed = currentStatus === 'closed';
    const target = isClosed ? 'new' : 'closed';
    const prev = rows.find((r) => r.id === id)?.status ?? null;

    // optimistic UI
    setRows((prevRows) => prevRows.map((r) => (r.id === id ? { ...r, status: target } : r)));

    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from('hospitals').update({ status: target }).eq('id', id);
      if (error) {
        console.error('Update status error', error);
        push({ type: 'error', text: `Failed to update status: ${error.message ?? 'unknown'}` });
        setRows((prevRows) => prevRows.map((r) => (r.id === id ? { ...r, status: prev } : r)));
        await fetchRows();
      } else {
        push({ type: 'success', text: `Status updated` });
      }
    } catch (e: any) {
      console.error('Unexpected status error', e);
      push({ type: 'error', text: `Failed to update status: ${e?.message ?? String(e)}` });
      setRows((prevRows) => prevRows.map((r) => (r.id === id ? { ...r, status: prev } : r)));
      await fetchRows();
    }
  };

  // toggle cold_emailed for single row (only if column exists)
  const toggleColdEmail = async (id: string, current?: boolean | null) => {
    if (!hasColdEmailedColumn) {
      push({ type: 'error', text: 'cold_emailed column missing — please add it to DB.' });
      return;
    }

    const target = !current;
    const prev = rows.find((r) => r.id === id)?.cold_emailed ?? false;

    setRows((prevRows) => prevRows.map((r) => (r.id === id ? { ...r, cold_emailed: target } : r)));

    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from('hospitals').update({ cold_emailed: target }).eq('id', id);

      if (error) {
        console.error('Update cold_emailed error', error);
        push({ type: 'error', text: `Failed to update cold-emailed: ${error.message ?? 'unknown'}` });
        setRows((prevRows) => prevRows.map((r) => (r.id === id ? { ...r, cold_emailed: prev } : r)));
        await fetchRows();
        return;
      }

      push({ type: 'success', text: target ? 'Marked cold-emailed' : 'Unmarked cold-emailed' });

      // optional: also add an audit row to cold_emails table (no-op if table is missing)
      try {
        await supabase.from('cold_emails').insert([{ hospital_id: id, acted_by: null, note: target ? 'marked cold-emailed' : 'unmarked cold-emailed' }]);
      } catch {
        /* ignore audit insert failures */
      }
    } catch (e: any) {
      console.error('Unexpected cold_emailed error', e);
      push({ type: 'error', text: `Failed to update cold-emailed: ${e?.message ?? String(e)}` });
      setRows((prevRows) => prevRows.map((r) => (r.id === id ? { ...r, cold_emailed: prev } : r)));
      await fetchRows();
    }
  };

  // bulk set status
  const bulkSetStatus = async (target: string) => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return push({ type: 'info', text: 'Select rows first' });

    // optimistic
    setRows((prevRows) => prevRows.map((r) => (ids.includes(r.id) ? { ...r, status: target } : r)));

    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from('hospitals').update({ status: target }).in('id', ids);
      if (error) {
        console.error('Bulk status error', error);
        push({ type: 'error', text: `Failed to update selected rows: ${error.message ?? 'unknown'}` });
        await fetchRows();
      } else {
        setSelected({});
        push({ type: 'success', text: `Updated ${ids.length} rows` });
      }
    } catch (e) {
      console.error('Unexpected bulk status error', e);
      push({ type: 'error', text: 'Failed to update selected rows. See console.' });
      await fetchRows();
    }
  };

  // bulk toggle cold_emailed
  const bulkToggleColdEmail = async (markAs: boolean) => {
    if (!hasColdEmailedColumn) {
      push({ type: 'error', text: 'cold_emailed column missing. Cannot bulk update.' });
      return;
    }
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return push({ type: 'info', text: 'Select rows first' });

    setRows((prevRows) => prevRows.map((r) => (ids.includes(r.id) ? { ...r, cold_emailed: markAs } : r)));

    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from('hospitals').update({ cold_emailed: markAs }).in('id', ids);
      if (error) {
        console.error('Bulk cold_emailed error', error);
        push({ type: 'error', text: `Failed to update cold-emailed: ${error.message ?? 'unknown'}` });
        await fetchRows();
      } else {
        // optional: add audit rows (best-effort)
        try {
          const auditRows = ids.map((id) => ({ hospital_id: id, acted_by: null, note: markAs ? 'bulk marked cold-emailed' : 'bulk unmarked cold-emailed' }));
          await supabase.from('cold_emails').insert(auditRows);
        } catch {
          /* ignore */
        }
        setSelected({});
        push({ type: 'success', text: `${ids.length} rows updated` });
      }
    } catch (e) {
      console.error('Unexpected bulk cold_emailed error', e);
      push({ type: 'error', text: 'Failed to update selected rows. See console.' });
      await fetchRows();
    }
  };

  // CSV export
  const exportCSV = () => {
    const cols = ['name', 'city', 'status', hasColdEmailedColumn ? 'cold_emailed' : undefined, 'website', 'emails', 'phones'].filter(Boolean) as string[];
    const body = filtered.map((r) =>
      cols
        .map((c) => {
          const v = (r as any)[c];
          if (Array.isArray(v)) return `"${v.join(';')}"`;
          return `"${String(v ?? '')}"`;
        })
        .join(',')
    );
    const csv = [cols.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hospitals-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    push({ type: 'success', text: 'Export started' });
  };

  const handleControlAction = (action: string) => {
    if (action === 'Mark selected closed') return bulkSetStatus('closed');
    if (action === 'Mark selected cold-emailed') return bulkToggleColdEmail(true);
    if (action === 'Unmark selected cold-emailed') return bulkToggleColdEmail(false);
    if (action === 'Export CSV') return exportCSV();
    if (action === 'Refresh') return fetchRows();
    push({ type: 'info', text: `Action: ${action}` });
  };

  const onSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const short = (s?: string | null, max = 30) => {
    if (!s) return '—';
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
  };

  return (
    <div className="min-h-screen bg-emerald-50 text-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* header KPIs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-emerald-800">Hospitals</h1>

          <div className="flex flex-wrap gap-3 items-center">
            {[
              { label: 'Total', value: totals.total },
              { label: 'Open', value: totals.open },
              { label: 'Reached / Closed', value: totals.closed, highlight: true },
              { label: 'Telemedicine', value: totals.telemed },
              { label: 'Cold-emailed', value: totals.emailed },
            ].map((k) => (
              <button
                key={k.label}
                onClick={() => {
                  // quick filter behavior: clicking KPIs toggles status filter
                  if (k.label === 'Reached / Closed') setStatus((s) => (s === 'closed' ? 'All statuses' : 'closed'));
                }}
                className={`bg-white rounded-lg p-3 text-slate-900 shadow-sm w-28 text-center transform transition hover:-translate-y-0.5 ${
                  k.highlight ? 'border-l-4 border-emerald-300' : ''
                }`}
                title={`${k.label}`}
              >
                <div className="text-xs text-slate-500">{k.label}</div>
                <div className={`text-lg font-semibold ${k.highlight ? 'text-emerald-700' : ''}`}>{k.value}</div>
              </button>
            ))}
          </div>
        </div>

        {/* controls */}
        <div className="bg-white rounded-lg p-3 md:p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <input
              className="w-full md:flex-1 rounded-md px-4 py-2 border border-slate-200 placeholder-slate-400"
              placeholder="Search name / city / email / phone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select className="rounded-md px-3 py-2 border border-slate-200 bg-white" value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select className="rounded-md px-3 py-2 border border-slate-200 bg-white" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <Dropdown
              label="Controls"
              items={[
                { value: 'Mark selected closed', label: 'Mark selected closed' },
                { value: 'Mark selected cold-emailed', label: 'Mark selected cold-emailed' },
                { value: 'Unmark selected cold-emailed', label: 'Unmark selected cold-emailed' },
                { value: 'Export CSV', label: 'Export CSV' },
                { value: 'Refresh', label: 'Refresh' },
              ]}
              onSelect={(v) => handleControlAction(String(v))}
            />

            <div className="flex gap-2">
              <button
                className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-md text-slate-900 font-semibold border border-slate-200"
                onClick={() => fetchRows()}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* responsive list: table for sm+, cards for mobile */}
        <div className="bg-white rounded-lg text-slate-900 shadow overflow-hidden">
          {/* TABLE (desktop) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y">
              <thead className="bg-emerald-50 sticky top-0">
                <tr className="text-left text-slate-700">
                  <th className="p-3 w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (!checked) return setSelected({});
                        const map: Record<string, boolean> = {};
                        rows.forEach((r) => (map[r.id] = true));
                        setSelected(map);
                      }}
                      aria-label="select all"
                    />
                  </th>

                  <th className="p-3 cursor-pointer" onClick={() => onSort('name')}>
                    <div className="flex items-center gap-2 text-sm font-medium">Name {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : null}</div>
                  </th>

                  <th className="p-3">City</th>
                  <th className="p-3">Telemed</th>
                  <th className="p-3">Emails</th>
                  <th className="p-3">Phones</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Cold-emailed</th>
                  <th className="p-3">Links</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      No hospitals match.
                    </td>
                  </tr>
                )}

                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-emerald-25">
                    <td className="p-3 align-top">
                      <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggleSelection(r.id)} aria-label={`select ${r.name}`} />
                    </td>

                    <td className="p-3 align-top font-semibold text-sm max-w-xs">
                      <div className="truncate w-56">{r.name}</div>
                      <div className="text-xs text-slate-500 truncate w-56">{r.address ?? ''}</div>
                    </td>

                    <td className="p-3 align-top text-sm">{r.city ?? '—'}</td>

                    <td className="p-3 align-top text-sm">{r.telemedicine ? 'Yes' : 'No'}</td>

                    <td className="p-3 align-top text-sm">{short(Array.isArray(r.emails) ? r.emails[0] : r.emails ?? '—', 36)}</td>

                    <td className="p-3 align-top text-sm">{short(Array.isArray(r.phones) ? r.phones[0] : r.phones ?? '—', 24)}</td>

                    <td className="p-3 align-top">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm ${r.status === 'closed' || r.status === 'reached' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                        {r.status ?? 'new'}
                      </span>
                    </td>

                    <td className="p-3 align-top text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm ${r.cold_emailed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                        {r.cold_emailed ? 'Yes' : 'No'}
                      </span>
                    </td>

                    <td className="p-3 align-top text-sm">
                      {r.website ? (
                        <a className="text-emerald-600 underline" href={r.website} target="_blank" rel="noreferrer">
                          site
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="p-3 align-top text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          className={`px-3 py-2 rounded-md font-semibold text-sm ${r.cold_emailed ? 'bg-slate-100 text-slate-900 border border-slate-200' : 'bg-emerald-100 text-emerald-800'}`}
                          onClick={() => toggleColdEmail(r.id, r.cold_emailed)}
                          title={r.cold_emailed ? 'Unmark cold-emailed' : 'Mark as cold-emailed'}
                        >
                          {r.cold_emailed ? 'Unmark emailed' : 'Mark emailed'}
                        </button>

                        <button
                          className={`px-3 py-2 rounded-md font-semibold text-sm ${r.status === 'closed' ? 'bg-slate-100 text-slate-900 border border-slate-200' : 'bg-emerald-100 text-emerald-800'}`}
                          onClick={() => toggleStatus(r.id, r.status)}
                          title={r.status === 'closed' ? 'Reopen' : 'Mark as closed'}
                        >
                          {r.status === 'closed' ? 'Reopen' : 'Mark closed'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CARD VIEW (mobile) */}
          <div className="sm:hidden">
            {loading && (
              <div className="p-6 text-center text-slate-500">
                Loading…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-slate-500">No hospitals match.</div>
            )}
            <div className="p-3 space-y-3">
              {filtered.map((r) => (
                <div key={r.id} className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.city ?? '—'} • {short(r.address ?? '', 48)}</div>
                      <div className="mt-2 text-xs text-slate-600">
                        <div>{Array.isArray(r.emails) ? r.emails[0] : r.emails ?? '—'}</div>
                        <div className="mt-1">{Array.isArray(r.phones) ? r.phones[0] : r.phones ?? '—'}</div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${r.status === 'closed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>{r.status ?? 'new'}</span>
                      </div>
                      <div className="mt-2 text-xs">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${r.cold_emailed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>{r.cold_emailed ? 'Emailed' : 'Not emailed'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      className={`w-full px-3 py-2 rounded-md font-semibold text-sm ${r.cold_emailed ? 'bg-slate-100 text-slate-900 border border-slate-200' : 'bg-emerald-100 text-emerald-800'}`}
                      onClick={() => toggleColdEmail(r.id, r.cold_emailed)}
                    >
                      {r.cold_emailed ? 'Unmark emailed' : 'Mark emailed'}
                    </button>

                    <button
                      className={`w-full px-3 py-2 rounded-md font-semibold text-sm ${r.status === 'closed' ? 'bg-slate-100 text-slate-900 border border-slate-200' : 'bg-emerald-100 text-emerald-800'}`}
                      onClick={() => toggleStatus(r.id, r.status)}
                    >
                      {r.status === 'closed' ? 'Reopen' : 'Mark closed'}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    {r.website ? (
                      <a className="text-emerald-600 underline" href={r.website} target="_blank" rel="noreferrer">
                        Visit site
                      </a>
                    ) : (
                      <span className="text-slate-400">No website</span>
                    )}
                    <span className="text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          Showing <strong>{filtered.length}</strong> rows (total <strong>{rows.length}</strong>).
        </div>
      </div>

      {/* Toasts */}
      <Toasts toasts={toasts} />
    </div>
  );
}
