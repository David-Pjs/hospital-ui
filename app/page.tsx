"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Papa from "papaparse";

type Hospital = {
  id: string;
  name: string;
  city: string | null;
  website: string | null;
  telemedicine: boolean | null;
  digital_services: string | null;
  emails: string[] | null;
  phones: string[] | null;
  linkedin: string | null;
  address: string | null;
  status: "new"|"queued"|"contacted"|"replied"|"won"|"lost"|"bad";
  manual_rating: number; // 0..5
  score: number;         // 0..100
  created_at: string;
  updated_at: string;
};

const STATUSES = ["new","queued","contacted","replied","won","lost","bad"] as const;

function blendScore(auto_score: number, manual_rating: number){
  // we don't have auto_score column here; score is manual-driven for now
  // you can compute auto on client if you want—keeping simple:
  const manualScaled = (manual_rating || 0) * 20; // 0..100
  return Math.round(manualScaled * 100) / 100;
}

export default function Home() {
  const [rows, setRows] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof Hospital>("score");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  // quick add form
  const [form, setForm] = useState({
    name: "", city: "", website: "", emails: "", phones: "",
    linkedin: "", address: "", telemedicine: "unknown", digital_services: ""
  });

  async function fetchRows(){
    setLoading(true);
    const { data, error } = await supabase
      .from("hospitals")
      .select("*")
      .order("score", { ascending: false })
      .limit(5000);
    if (error) console.error(error);
    setRows((data || []) as Hospital[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchRows();
    // realtime optional
    // const ch = supabase.channel("hospitals-ch")
    //   .on("postgres_changes",{event:"*",schema:"public",table:"hospitals"}, fetchRows)
    //   .subscribe();
    // return () => { supabase.removeChannel(ch); };
  }, []);

  // derive city options
  const cities = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.city && s.add(r.city));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let arr = [...rows];
    if (q.trim()) {
      const needle = q.toLowerCase();
      arr = arr.filter(r => (
        (r.name||"").toLowerCase().includes(needle) ||
        (r.city||"").toLowerCase().includes(needle) ||
        (r.address||"").toLowerCase().includes(needle) ||
        (r.emails||[]).join(",").toLowerCase().includes(needle) ||
        (r.phones||[]).join(",").toLowerCase().includes(needle) ||
        (r.digital_services||"").toLowerCase().includes(needle)
      ));
    }
    if (city) arr = arr.filter(r => (r.city||"") === city);
    if (statusFilter) arr = arr.filter(r => r.status === statusFilter);
    arr.sort((a,b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, q, city, statusFilter, sortKey, sortDir]);

  function toggleSort(k: keyof Hospital){
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  async function updateRow(id: string, patch: Partial<Hospital>){
    const { data, error } = await supabase
      .from("hospitals")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) { console.error(error); return; }
    setRows(prev => prev.map(r => r.id === id ? (data as Hospital) : r));
  }

  async function setStatus(id: string, status: Hospital["status"]){
    await updateRow(id, { status });
  }

  async function setRating(id: string, rating: number){
    const score = blendScore(0, rating);
    await updateRow(id, { manual_rating: rating, score });
  }

  async function addHospital(){
    if (!form.name.trim()) return;
    const tele = form.telemedicine === "yes" ? true : form.telemedicine === "no" ? false : null;
    const emails = form.emails.split(",").map(s=>s.trim()).filter(Boolean);
    const phones = form.phones.split(",").map(s=>s.trim()).filter(Boolean);
    const { data, error } = await supabase
      .from("hospitals")
      .insert({
        name: form.name.trim(),
        city: form.city || null,
        website: form.website || null,
        emails, phones,
        linkedin: form.linkedin || null,
        address: form.address || null,
        telemedicine: tele,
        digital_services: form.digital_services || null,
        status: "new",
        manual_rating: 0,
        score: 0
      }).select("*").single();
    if (error) { console.error(error); return; }
    setRows(prev => [data as Hospital, ...prev]);
    setForm({ name:"", city:"", website:"", emails:"", phones:"", linkedin:"", address:"", telemedicine:"unknown", digital_services:"" });
  }

  async function importCSV(file: File){
    return new Promise<void>((resolve) => {
      Papa.parse(file, {
        header: true,
        complete: async (res) => {
          const rows = res.data as any[];
          for (const r of rows){
            if (!r.name && !r.Name) continue;
            const name = (r.name || r.Name || "").trim();
            const city = r.city || r.City || null;
            const website = r.website || r.Website || null;
            const teleRaw = r.telemedicine ?? r.Telemedicine ?? r.telemedicine_usage;
            const tele = typeof teleRaw === "string"
              ? (teleRaw.toLowerCase().startsWith("y") ? true : teleRaw.toLowerCase().startsWith("n") ? false : null)
              : (teleRaw ?? null);
            const emails = (r.emails || r.Email || r.email || "")
              .toString().split(/[;,]/).map((s:string)=>s.trim()).filter(Boolean);
            const phones = (r.phones || r.Phone || "")
              .toString().split(/[;,]/).map((s:string)=>s.trim()).filter(Boolean);
            const linkedin = r.linkedin || r.LinkedIn || null;
            const address = r.address || r.Address || null;
            const digital_services = r.digital_services || r["Digital Services"] || r.digital_services_description || null;

            await supabase.from("hospitals").insert({
              name, city, website, telemedicine: tele, emails, phones, linkedin, address,
              digital_services, status:"new", manual_rating:0, score:0
            });
          }
          await fetchRows();
          resolve();
        }
      });
    });
  }

  return (
    <div className="container">
      <h1>Hospitals</h1>
      <div className="panel">
        <div className="toolbar">
          <input placeholder="Search name/city/address/email/phone…" value={q} onChange={e=>setQ(e.target.value)} />
          <select value={city} onChange={e=>setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label>
            <input type="file" accept=".csv" style={{display:"none"}}
              onChange={(e)=>{ const f=e.target.files?.[0]; if (f) importCSV(f); }} />
            <button className="secondary">Import CSV</button>
          </label>
        </div>

        <div className="hr" />

        <div style={{marginBottom:12}}>
          <div className="row" style={{marginBottom:8}}>
            <input placeholder="Name *" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
            <input placeholder="City" value={form.city} onChange={e=>setForm({...form, city:e.target.value})}/>
          </div>
          <div className="row" style={{marginBottom:8}}>
            <input placeholder="Website" value={form.website} onChange={e=>setForm({...form, website:e.target.value})}/>
            <input placeholder="Emails (comma-separated)" value={form.emails} onChange={e=>setForm({...form, emails:e.target.value})}/>
          </div>
          <div className="row" style={{marginBottom:8}}>
            <input placeholder="Phones (comma-separated)" value={form.phones} onChange={e=>setForm({...form, phones:e.target.value})}/>
            <input placeholder="LinkedIn" value={form.linkedin} onChange={e=>setForm({...form, linkedin:e.target.value})}/>
          </div>
          <div className="row" style={{marginBottom:8}}>
            <input placeholder="Address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/>
            <select value={form.telemedicine} onChange={e=>setForm({...form, telemedicine:e.target.value})}>
              <option value="unknown">Telemedicine: Unknown</option>
              <option value="yes">Telemedicine: Yes</option>
              <option value="no">Telemedicine: No</option>
            </select>
          </div>
          <textarea placeholder="Digital services / notes…" rows={2}
            value={form.digital_services} onChange={e=>setForm({...form, digital_services:e.target.value})}/>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button onClick={addHospital}>Add Hospital</button>
            <button className="secondary" onClick={fetchRows}>Refresh</button>
            <small className="muted">Add quickly; edit in table below.</small>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th onClick={()=>toggleSort("score")}>Score {sortKey==="score"?(sortDir==="asc"?"▲":"▼"): ""}</th>
                <th onClick={()=>toggleSort("name")}>Name {sortKey==="name"?(sortDir==="asc"?"▲":"▼"): ""}</th>
                <th>City</th>
                <th>Telemed</th>
                <th>Emails</th>
                <th>Phones</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9}>No rows.</td></tr>
              ) : filtered.map(h => (
                <tr key={h.id}>
                  <td><span className="badge">{h.score}</span><br/><small className="muted">m {h.manual_rating}</small></td>
                  <td>
                    <div style={{fontWeight:600}}>{h.name}</div>
                    {h.address ? <div><small className="muted">{h.address}</small></div> : null}
                    {h.digital_services ? <div><small className="muted">{h.digital_services}</small></div> : null}
                  </td>
                  <td>{h.city || <small className="muted">—</small>}</td>
                  <td>{h.telemedicine === null ? <small className="muted">—</small> : h.telemedicine ? "Yes" : "No"}</td>
                  <td>{(h.emails||[]).length ? (h.emails||[]).map(e=><div key={e}><small>{e}</small></div>) : <small className="muted">—</small>}</td>
                  <td>{(h.phones||[]).length ? (h.phones||[]).map(p=><div key={p}><small>{p}</small></div>) : <small className="muted">—</small>}</td>
                  <td>
                    <select value={h.status} onChange={(e)=>setStatus(h.id, e.target.value as Hospital["status"])}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={h.manual_rating} onChange={(e)=>setRating(h.id, Number(e.target.value))}>
                      {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {h.website ? <a href={h.website} target="_blank">Website</a> : null}
                      {h.linkedin ? <a href={h.linkedin} target="_blank">LinkedIn</a> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
