// Analytics Summary — batch breakdown, instructor load, AP-127 spotlight
const { useMemo: useM_s, useState: useS_s } = React;

// Palette for AP batches (cycles if more than defined)
const BATCH_COLORS = [
  'oklch(0.72 0.18 260)',  // blue-ish
  'oklch(0.75 0.18 145)',  // green
  'oklch(0.80 0.16  75)',  // amber
  'oklch(0.78 0.18 320)',  // pink/highlight (AP-127 slot)
  'oklch(0.72 0.16  30)',  // red-orange
  'oklch(0.70 0.14 200)',  // teal
  'oklch(0.74 0.15 290)',  // purple
];

// Simple SVG donut chart
function DonutChart({ slices, size=150, ring=22 }) {
  // slices: [{label, value, color}]
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total === 0) return (
    <div style={{ width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <span className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>NO DATA</span>
    </div>
  );
  const r   = (size - ring) / 2;
  const cx  = size / 2;
  const cy  = size / 2;
  const C   = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      {slices.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * C;
        const gap  = C - dash;
        const el = (
          <circle key={s.label}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={ring}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * C}
            opacity={0.88}
          />
        );
        offset += frac;
        return el;
      })}
      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={r - ring/2 - 4} fill="var(--bg-2)" opacity={0.6}/>
    </svg>
  );
}

function BreakdownTable({ title, subtitle, rows, nameKey='batch' }) {
  const maxTotal = Math.max(...rows.map(r=>r.total), 1);
  const pct = w => `${((w/maxTotal)*100).toFixed(1)}%`;
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, overflow:'hidden' }}>
      <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--line)', background:'var(--bg-2)' }}>
        <div className="mono uc" style={{ fontSize:10,color:'var(--ink)',fontWeight:600 }}>{title}</div>
        {subtitle && <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',marginTop:1 }}>{subtitle}</div>}
      </div>
      <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {rows.length === 0 && <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',padding:'8px 0' }}>NO DATA</div>}
        {rows.map(r=>{
          const name = r[nameKey];
          const isHL = name === HIGHLIGHT_BATCH;
          return (
            <div key={name} style={{ display:'flex',gap:10,alignItems:'center' }}>
              <div className="mono uc" style={{ width:120,fontSize:10,flexShrink:0,color:isHL?'var(--highlight)':'var(--ink-2)',fontWeight:isHL?600:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={name}>{name}</div>
              <div style={{ flex:1, position:'relative', height:18, display:'flex', borderRadius:3, overflow:'hidden', gap:1, background:'var(--bg-2)' }}>
                {r.pending>0   && <div title={`Pending: ${r.pending}`}   style={{ width:pct(r.pending),   background:'var(--col-pending)', opacity:.85, transition:'width .3s' }}/>}
                {r.completed>0 && <div title={`Completed: ${r.completed}`} style={{ width:pct(r.completed), background:'var(--col-done)',    opacity:.85, transition:'width .3s' }}/>}
                {r.canceled>0  && <div title={`Canceled: ${r.canceled}`}  style={{ width:pct(r.canceled),  background:'var(--col-cancel)',  opacity:.85, transition:'width .3s' }}/>}
                {r.standby>0   && <div title={`Standby: ${r.standby}`}    style={{ width:pct(r.standby),   background:'var(--col-stby)',    opacity:.85, transition:'width .3s' }}/>}
              </div>
              <div className="mono num" style={{ width:26,fontSize:10,color:'var(--ink-3)',textAlign:'right',flexShrink:0 }}>{r.total}</div>
              <div className="mono num" style={{ width:44,fontSize:9,color:'var(--ink-3)',textAlign:'right',flexShrink:0 }}>{r.hours.toFixed(1)}h</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryBoard() {
  const app = useApp();
  const { isMobile } = app;
  const [dateFrom, setDateFrom] = useS_s(ALL_DATES[0]);
  const [dateTo,   setDateTo]   = useS_s(ALL_DATES[ALL_DATES.length - 1]);

  const all = useM_s(()=> {
    return FLIGHTS.filter(f => {
      if (!app.tweaks.showSim && f.isSim) return false;
      if (f.date < dateFrom || f.date > dateTo) return false;
      return true;
    });
  }, [app.tweaks.showSim, dateFrom, dateTo]);

  const totalStats = useM_s(()=>{
    const s={total:all.length,pending:0,completed:0,canceled:0,standby:0,sim:0,hours:0};
    all.forEach(f=>{
      if(f.status==='Pending')   s.pending++;
      if(f.status==='Completed') s.completed++;
      if(f.status==='Canceled')  s.canceled++;
      if(f.isStandby) s.standby++;
      if(f.isSim)     s.sim++;
      s.hours += (f.durMin||0)/60;
    });
    return s;
  },[all]);

  const batchStats = useM_s(()=>{
    const m={};
    all.forEach(f=>{
      const b=f.batch||'Unknown';
      if(!m[b]) m[b]={batch:b,total:0,pending:0,completed:0,canceled:0,hours:0,standby:0};
      m[b].total++; m[b].hours+=(f.durMin||0)/60;
      if(f.status==='Pending')   m[b].pending++;
      if(f.status==='Completed') m[b].completed++;
      if(f.status==='Canceled')  m[b].canceled++;
      if(f.isStandby)            m[b].standby++;
    });
    return Object.values(m).sort((a,b)=>b.total-a.total);
  },[all]);

  const instrStats = useM_s(()=>{
    const m={};
    all.forEach(f=>{
      const k=f.instructor||'—';
      if(!m[k]) m[k]={name:k,total:0,hours:0,pending:0,completed:0,canceled:0,standby:0};
      m[k].total++; m[k].hours+=(f.durMin||0)/60;
      if(f.status==='Pending')   m[k].pending++;
      if(f.status==='Completed') m[k].completed++;
      if(f.status==='Canceled')  m[k].canceled++;
      if(f.isStandby)            m[k].standby++;
    });
    return Object.values(m).sort((a,b)=>b.total-a.total);
  },[all]);

  const studentStats = useM_s(()=>{
    const m={};
    all.forEach(f=>{
      const k=f.student||'—';
      if(!m[k]) m[k]={name:k,total:0,hours:0,pending:0,completed:0,canceled:0,standby:0};
      m[k].total++; m[k].hours+=(f.durMin||0)/60;
      if(f.status==='Pending')   m[k].pending++;
      if(f.status==='Completed') m[k].completed++;
      if(f.status==='Canceled')  m[k].canceled++;
      if(f.isStandby)            m[k].standby++;
    });
    return Object.values(m).sort((a,b)=>b.total-a.total);
  },[all]);

  const ap127StudentStats = useM_s(()=>{
    const m={};
    all.filter(f=>f.batch===HIGHLIGHT_BATCH).forEach(f=>{
      const k=f.student||'—';
      if(!m[k]) m[k]={name:k,total:0,hours:0,pending:0,completed:0,canceled:0,standby:0};
      m[k].total++; m[k].hours+=(f.durMin||0)/60;
      if(f.status==='Pending')   m[k].pending++;
      if(f.status==='Completed') m[k].completed++;
      if(f.status==='Canceled')  m[k].canceled++;
      if(f.isStandby)            m[k].standby++;
    });
    return Object.values(m).sort((a,b)=>b.total-a.total);
  },[all]);

  // AP-batch pie: only batches starting with "AP-"
  const apBatchSlices = useM_s(()=>{
    const apBatches = batchStats.filter(b => /^AP-/i.test(b.batch));
    // Sort by batch name ascending (AP-124, AP-125, ...)
    apBatches.sort((a,b) => a.batch.localeCompare(b.batch));
    return apBatches.map((b, i) => ({
      label: b.batch,
      value: b.total,
      hours: b.hours,
      color: b.batch === HIGHLIGHT_BATCH
        ? 'var(--highlight)'
        : BATCH_COLORS[i % BATCH_COLORS.length],
    }));
  }, [batchStats]);

  const SumTile = ({label,value,color,sub}) => (
    <div style={{ flex:1, padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, borderTop:`2px solid ${color}`, minWidth:80 }}>
      <div className="mono uc" style={{ fontSize:8,color:'var(--ink-3)' }}>{label}</div>
      <div className="num" style={{ fontSize:24,fontWeight:600,lineHeight:1.1,color:'var(--ink)',marginTop:2 }}>{String(value).padStart(2,'0')}</div>
      {sub&&<div className="mono uc" style={{ fontSize:8,color:'var(--ink-3)',marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <ArtboardShell style={{ display:'flex', flexDirection:'column' }}>
      <ThemeStyle/>
      {/* Header — compact single strip */}
      <div style={{ height:38, padding:'0 16px', borderBottom:'1px solid var(--line)', background:'var(--bg-2)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'nowrap' }}>
        <div style={{ display:'flex',alignItems:'center',gap:7 }}>
          <span style={{ width:8,height:8,borderRadius:999,background:'var(--col-pending)',boxShadow:'0 0 8px var(--col-pending)' }}/>
          <ViewIcon id="summary" size={12} color="var(--ink-2)"/>
          <div className="mono uc" style={{ fontSize:11,fontWeight:600 }}>ANALYTICS</div>
        </div>
        {/* Date range inline */}
        <div style={{ display:'flex', gap:6, alignItems:'center', marginLeft:8 }}>
          {[['FROM', dateFrom, setDateFrom], ['TO', dateTo, setDateTo]].map(([lbl, val, setter])=>(
            <label key={lbl} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span className="mono uc" style={{ fontSize:8,color:'var(--ink-3)' }}>{lbl}</span>
              <select className="mono" value={val} onChange={e=>setter(e.target.value)}
                style={{ background:'var(--surface)', color:'var(--ink)', border:'1px solid var(--line)', borderRadius:4, padding:'2px 6px', fontSize:10, outline:'none' }}>
                {ALL_DATES.map(d=>{ const {wd,mo,day}=fmtDay(d); return <option key={d} value={d}>{wd} {String(day).padStart(2,'0')} {mo}</option>; })}
              </select>
            </label>
          ))}
          <button className="mono uc" onClick={()=>{ setDateFrom(ALL_DATES[0]); setDateTo(ALL_DATES[ALL_DATES.length-1]); }}
            style={{ fontSize:8, padding:'2px 6px', borderRadius:4, border:'1px solid var(--line)', background:'transparent', color:'var(--ink-3)', cursor:'pointer' }}>
            ALL
          </button>
        </div>
        <div style={{flex:1}}/>
        <FocusControls/>
        <span className="mono uc" style={{ fontSize:9, color:'var(--ink-3)' }}>{all.length} FLT</span>
      </div>

      {/* Body: scrollable data area */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
      <div style={{ padding:'14px 20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Stat tiles */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <SumTile label="TOTAL" value={totalStats.total} color="var(--ink-2)" sub={`${totalStats.hours.toFixed(0)}h`}/>
          <SumTile label="PENDING"   value={totalStats.pending}   color="var(--col-pending)"/>
          <SumTile label="COMPLETED" value={totalStats.completed} color="var(--col-done)"/>
          <SumTile label="CANCELED"  value={totalStats.canceled}  color="var(--col-cancel)"/>
          <SumTile label="STANDBY"   value={totalStats.standby}   color="var(--col-stby)"/>
          <SumTile label="SIM"       value={totalStats.sim}       color="var(--col-sim)"/>
        </div>

        {/* AP Batch Pie + AP-127 Student breakdown */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, alignItems:'start' }}>

          {/* Donut chart card */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--line)', background:'var(--bg-2)' }}>
              <div className="mono uc" style={{ fontSize:10,color:'var(--ink)',fontWeight:600 }}>AP BATCH COMPARISON</div>
              <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',marginTop:1 }}>TOTAL FLIGHTS PER BATCH</div>
            </div>
            <div style={{ padding:'16px', display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
              <DonutChart slices={apBatchSlices} size={isMobile?120:150} ring={20}/>
              {/* Legend */}
              <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1, minWidth:120 }}>
                {apBatchSlices.map(s => (
                  <div key={s.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }}/>
                    <span className="mono uc" style={{ fontSize:10, color: s.label===HIGHLIGHT_BATCH?'var(--highlight)':'var(--ink-2)', fontWeight: s.label===HIGHLIGHT_BATCH?600:400, flex:1 }}>{s.label}</span>
                    <span className="mono num" style={{ fontSize:10, color:'var(--ink-3)' }}>{s.value}</span>
                    <span className="mono" style={{ fontSize:9, color:'var(--ink-3)', minWidth:36, textAlign:'right' }}>{s.hours.toFixed(1)}h</span>
                  </div>
                ))}
                {apBatchSlices.length === 0 && <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>NO AP BATCHES IN RANGE</div>}
              </div>
            </div>
          </div>

          {/* AP-127 student breakdown */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--highlight)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--line)', background:'color-mix(in oklch,var(--highlight) 8%,var(--bg-2))' }}>
              <div className="mono uc" style={{ fontSize:10,color:'var(--highlight)',fontWeight:600 }}>◆ AP-127 STUDENTS</div>
              <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',marginTop:1 }}>PENDING · COMPLETED · CANCELED</div>
            </div>
            <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:8 }}>
              {ap127StudentStats.length === 0 && <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',padding:'8px 0' }}>NO AP-127 FLIGHTS IN RANGE</div>}
              {ap127StudentStats.map(r=>{
                const maxT = Math.max(...ap127StudentStats.map(x=>x.total), 1);
                const pct = w => `${((w/maxT)*100).toFixed(1)}%`;
                return (
                  <div key={r.name} style={{ display:'flex',gap:10,alignItems:'center' }}>
                    <div className="mono uc" style={{ width:120,fontSize:10,flexShrink:0,color:'var(--highlight)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={r.name}>{r.name}</div>
                    <div style={{ flex:1, height:18, display:'flex', borderRadius:3, overflow:'hidden', gap:1, background:'var(--bg-2)' }}>
                      {r.pending>0   && <div title={`Pending: ${r.pending}`}   style={{ width:pct(r.pending),   background:'var(--col-pending)', opacity:.85 }}/>}
                      {r.completed>0 && <div title={`Completed: ${r.completed}`} style={{ width:pct(r.completed), background:'var(--col-done)',    opacity:.85 }}/>}
                      {r.canceled>0  && <div title={`Canceled: ${r.canceled}`}  style={{ width:pct(r.canceled),  background:'var(--col-cancel)',  opacity:.85 }}/>}
                      {r.standby>0   && <div title={`Standby: ${r.standby}`}    style={{ width:pct(r.standby),   background:'var(--col-stby)',    opacity:.85 }}/>}
                    </div>
                    <div className="mono num" style={{ width:26,fontSize:10,color:'var(--ink-3)',textAlign:'right',flexShrink:0 }}>{r.total}</div>
                    <div className="mono num" style={{ width:44,fontSize:9,color:'var(--ink-3)',textAlign:'right',flexShrink:0 }}>{r.hours.toFixed(1)}h</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Batch breakdown */}
        <BreakdownTable title="BATCH BREAKDOWN" subtitle="PENDING · COMPLETED · CANCELED · STANDBY" rows={batchStats} nameKey="batch"/>

        {/* Instructor breakdown */}
        <BreakdownTable title="INSTRUCTOR BREAKDOWN" subtitle="PENDING · COMPLETED · CANCELED · STANDBY" rows={instrStats} nameKey="name"/>

        {/* Student breakdown */}
        <BreakdownTable title="STUDENT BREAKDOWN" subtitle="PENDING · COMPLETED · CANCELED · STANDBY" rows={studentStats} nameKey="name"/>

      </div>{/* end inner flex column */}
      </div>{/* end scroll container */}
      <Drawer/>
    </ArtboardShell>
  );
}

window.SummaryBoard = SummaryBoard;
