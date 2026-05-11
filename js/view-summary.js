// Analytics Summary — batch breakdown, instructor load, AP-127 spotlight
const { useMemo: useM_s, useState: useS_s } = React;

function BreakdownTable({ title, subtitle, rows, nameKey='batch' }) {
  const maxTotal = Math.max(...rows.map(r=>r.total), 1);
  const pct = w => `${((w/maxTotal)*100).toFixed(1)}%`;
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--line)', background:'var(--bg-2)' }}>
        <div className="mono uc" style={{ fontSize:10,color:'var(--ink)',fontWeight:600 }}>{title}</div>
        {subtitle && <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',marginTop:2 }}>{subtitle}</div>}
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
  const [dateFrom, setDateFrom] = useS_s(ALL_DATES[0]);
  const [dateTo,   setDateTo]   = useS_s(ALL_DATES[ALL_DATES.length - 1]);
  const [ctrlH, handleResizeDown] = useResizable(52, 0, 100);

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

  const SumTile = ({label,value,color,sub}) => (
    <div style={{ flex:1, padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, borderTop:`2px solid ${color}`, minWidth:100 }}>
      <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>{label}</div>
      <div className="num" style={{ fontSize:34,fontWeight:600,lineHeight:1.05,color:'var(--ink)',marginTop:2 }}>{String(value).padStart(2,'0')}</div>
      {sub&&<div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',marginTop:3 }}>{sub}</div>}
    </div>
  );

  return (
    <ArtboardShell style={{ display:'flex', flexDirection:'column' }}>
      <ThemeStyle/>
      {/* Header */}
      <div style={{ height:38, padding:'0 20px', borderBottom:'1px solid var(--line)', background:'var(--bg-2)', display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ width:8,height:8,borderRadius:999,background:'var(--col-pending)',boxShadow:'0 0 8px var(--col-pending)' }}/>
          <div className="mono uc" style={{ fontSize:11,fontWeight:600 }}>ANALYTICS SUMMARY</div>
        </div>
        <div style={{flex:1}}/>
        <div className="mono uc" style={{ fontSize:10,color:'var(--ink-3)' }}>FEED: {window.FLIGHT_DATA.fetchedAt}</div>
      </div>

      <InlineSettings/>

      {/* Date range selector — resizable */}
      <div style={{ height:ctrlH, overflow:'hidden', flexShrink:0 }}>
        <div style={{ padding:'8px 24px', borderBottom:'1px solid var(--line-soft)', background:'var(--bg-2)', display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
          <span className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>DATE RANGE</span>
          {[['FROM', dateFrom, setDateFrom], ['TO', dateTo, setDateTo]].map(([lbl, val, setter])=>(
            <label key={lbl} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>{lbl}</span>
              <select className="mono" value={val} onChange={e=>setter(e.target.value)}
                style={{ background:'var(--surface)', color:'var(--ink)', border:'1px solid var(--line)', borderRadius:4, padding:'4px 8px', fontSize:11, outline:'none' }}>
                {ALL_DATES.map(d=>{ const {wd,mo,day}=fmtDay(d); return <option key={d} value={d}>{wd} {String(day).padStart(2,'0')} {mo}</option>; })}
              </select>
            </label>
          ))}
          <button className="mono uc" onClick={()=>{ setDateFrom(ALL_DATES[0]); setDateTo(ALL_DATES[ALL_DATES.length-1]); }}
            style={{ fontSize:9, padding:'4px 8px', borderRadius:4, border:'1px solid var(--line)', background:'transparent', color:'var(--ink-3)', cursor:'pointer' }}>
            RESET
          </button>
          <span className="mono" style={{ fontSize:10, color:'var(--ink-3)', marginLeft:'auto' }}>{all.length} FLIGHTS IN RANGE</span>
        </div>
      </div>

      <ResizeHandle onMouseDown={handleResizeDown}/>

      {/* Body: scrollable data area */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
      <div style={{ padding:'16px 24px 24px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Stat tiles */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <SumTile label="TOTAL FLIGHTS" value={totalStats.total} color="var(--ink-2)" sub={`${totalStats.hours.toFixed(0)} HRS SCHEDULED`}/>
          <SumTile label="PENDING"   value={totalStats.pending}   color="var(--col-pending)"/>
          <SumTile label="COMPLETED" value={totalStats.completed} color="var(--col-done)"/>
          <SumTile label="CANCELED"  value={totalStats.canceled}  color="var(--col-cancel)"/>
          <SumTile label="STANDBY"   value={totalStats.standby}   color="var(--col-stby)"/>
          <SumTile label="SIM SLOTS" value={totalStats.sim}       color="var(--col-sim)"/>
        </div>

        {/* Main two-column section */}
        <div style={{ display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:16, alignItems:'start' }}>

          {/* Batch breakdown */}
          <BreakdownTable title="BATCH BREAKDOWN" subtitle="PENDING · COMPLETED · CANCELED · STANDBY" rows={batchStats} nameKey="batch"/>

          {/* AP-127 student breakdown */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--highlight)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--line)', background:'color-mix(in oklch,var(--highlight) 8%,var(--bg-2))' }}>
              <div className="mono uc" style={{ fontSize:10,color:'var(--highlight)',fontWeight:600 }}>◆ AP-127 STUDENT BREAKDOWN</div>
              <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)',marginTop:2 }}>PENDING · COMPLETED · CANCELED · STANDBY</div>
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
