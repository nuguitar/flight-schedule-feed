// Weekly Monitor — all dates as columns, flight cards scrollable per column
const { useMemo: useM_w } = React;

function WeeklyBoard() {
  const app = useApp();

  const weekFlights = useM_w(()=>{
    return FLIGHTS.filter(f=>{
      if (!app.tweaks.showSim     && f.isSim)     return false;
      if (!app.tweaks.showStandby && f.isStandby) return false;
      if (app.filters.batch      !== 'ALL' && f.batch      !== app.filters.batch)      return false;
      if (app.filters.instructor !== 'ALL' && f.instructor !== app.filters.instructor) return false;
      if (app.filters.tail       !== 'ALL' && f.tail       !== app.filters.tail)       return false;
      if (app.filters.status === 'Standby') { if (!f.isStandby) return false; }
      else if (app.filters.status !== 'ALL' && f.status !== app.filters.status)        return false;
      if (app.hideOthers && app.highlightAP127 && f.batch !== HIGHLIGHT_BATCH)         return false;
      if (app.filters.search) {
        const q = app.filters.search.toLowerCase();
        const hay = [f.student,f.instructor,f.batch,f.lesson,f.tail,f.type].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  },[app.tweaks.showSim, app.tweaks.showStandby, app.filters, app.hideOthers, app.highlightAP127]);

  const today = new Date().toISOString().slice(0,10);

  const byDate = useM_w(()=>{
    const m={};
    weekFlights.forEach(f=>{ (m[f.date]||=[]).push(f); });
    ALL_DATES.forEach(d=>{ if(!m[d]) m[d]=[]; });
    return m;
  },[weekFlights]);

  return (
    <ArtboardShell style={{ display:'flex', flexDirection:'column' }}>
      <ThemeStyle/>
      {/* Header */}
      <div style={{ height:38, padding:'0 16px', borderBottom:'1px solid var(--line)', background:'var(--bg-2)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ width:8,height:8,borderRadius:999,background:'var(--col-done)',boxShadow:'0 0 8px var(--col-done)' }}/>
          <ViewIcon id="weekly" size={12} color="var(--ink-2)"/>
          <div className="mono uc" style={{ fontSize:11,fontWeight:600 }}>WEEKLY</div>
        </div>
        <div style={{flex:1}}/>
        <FocusControls/>
        <div className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>{ALL_DATES.length} DATES</div>
      </div>

      {/* Filter */}
      <div style={{ padding:'4px 8px', flexShrink:0 }}>
        <FilterBar/>
      </div>

      {/* Column grid */}
      <div style={{ flex:1, minHeight:0, padding:'0 6px 6px', overflowX:'auto', overflowY:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', gap:10, height:'100%', minWidth:'max-content' }}>
          {ALL_DATES.map(d=>{
            const { wd, mo, day } = fmtDay(d);
            const list = [...(byDate[d]||[])].sort((a,b)=>(minutesOf(a.start)||0)-(minutesOf(b.start)||0));
            const sel  = d === app.date;
            const past = d < today;
            const tod  = d === today;

            const statP = list.filter(f=>f.status==='Pending').length;
            const statC = list.filter(f=>f.status==='Completed').length;
            const statX = list.filter(f=>f.status==='Canceled').length;
            const statS = list.filter(f=>f.isStandby).length;

            return (
              <div key={d} style={{
                width:192, display:'flex', flexDirection:'column',
                border:`1px solid ${sel?'var(--col-pending)':tod?'color-mix(in oklch,var(--col-pending) 40%,var(--line))':'var(--line)'}`,
                borderRadius:8, background:'var(--surface)', overflow:'hidden',
                opacity: past&&!sel ? 0.65 : 1,
                flexShrink:0,
              }}>
                {/* Column header */}
                <div onClick={()=>app.setDate(d)} style={{
                  padding:'10px 12px', borderBottom:'1px solid var(--line)', cursor:'pointer',
                  background: sel?'color-mix(in oklch,var(--col-pending) 12%,var(--bg-2))':'var(--bg-2)',
                  borderTop: `2px solid ${past?'var(--ink-3)':tod?'var(--col-pending)':'var(--col-done)'}`,
                }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <span className="num" style={{ fontSize:22,fontWeight:600,color:'var(--ink)' }}>{String(day).padStart(2,'0')}</span>
                    <span className="mono uc" style={{ fontSize:10,color:'var(--ink-2)' }}>{mo}</span>
                    <span style={{flex:1}}/>
                    <span className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>{wd}</span>
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:6, alignItems:'center' }}>
                    {tod && <span className="mono uc" style={{ fontSize:8,color:'var(--col-pending)',padding:'1px 5px',border:'1px solid var(--col-pending)',borderRadius:3 }}>TODAY</span>}
                    {past && !tod && <span className="mono uc" style={{ fontSize:8,color:'var(--ink-3)' }}>PAST</span>}
                    <span style={{flex:1}}/>
                    <span className="mono uc" style={{ fontSize:9,color:'var(--ink-3)' }}>{list.length} FLT</span>
                  </div>
                  {list.length>0&&(
                    <div style={{ display:'flex', gap:5, marginTop:6, alignItems:'center' }}>
                      {statP>0&&<span className="mono uc" style={{ fontSize:8,color:'var(--col-pending)' }}>P:{statP}</span>}
                      {statC>0&&<span className="mono uc" style={{ fontSize:8,color:'var(--col-done)' }}>C:{statC}</span>}
                      {statX>0&&<span className="mono uc" style={{ fontSize:8,color:'var(--col-cancel)' }}>X:{statX}</span>}
                      {statS>0&&<span className="mono uc" style={{ fontSize:8,color:'var(--col-stby)' }}>S:{statS}</span>}
                    </div>
                  )}
                </div>
                {/* Flight cards */}
                <div style={{ overflowY:'auto', flex:1, padding:'6px 8px', display:'flex', flexDirection:'column', gap:5 }}>
                  {list.length===0&&<div className="mono uc" style={{ padding:16,textAlign:'center',color:'var(--ink-3)',fontSize:9 }}>NO FLIGHTS</div>}
                  {list.map((f,fi)=>{
                    const color = STATUS_COLOR(f);
                    const alpha = flightAlpha(f, app.highlightAP127);
                    return (
                      <button key={`${d}-${f.id}-${fi}`} onClick={()=>{ app.setDate(d); app.setDrawer(f.id); }}
                        style={{
                          textAlign:'left', padding:'7px 8px',
                          background:`color-mix(in oklch,${color} 8%,var(--bg-2))`,
                          border:`1px solid color-mix(in oklch,${color} 30%,var(--line))`,
                          borderLeft:`3px solid ${color}`,
                          borderRadius:5, cursor:'pointer', color:'var(--ink)',
                          display:'flex', flexDirection:'column', gap:3,
                          opacity:alpha, transition:'opacity .12s',
                        }}>
                        <div style={{ display:'flex',gap:6,alignItems:'baseline' }}>
                          <span className="mono num" style={{ fontSize:12,fontWeight:600,color:'var(--ink)' }}>{f.start}</span>
                          <span className="mono uc" style={{ fontSize:8,color:f.batch===HIGHLIGHT_BATCH?'var(--highlight)':'var(--ink-3)',fontWeight:f.batch===HIGHLIGHT_BATCH?600:400 }}>{f.batch}</span>
                        </div>
                        <div style={{ fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--ink)' }}>{f.student||'—'}</div>
                        <div style={{ display:'flex',gap:5,alignItems:'center' }}>
                          <span className="mono" style={{ fontSize:9,color:'var(--ink-3)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{f.tail||'TBD'}</span>
                          {f.isStandby&&<span className="mono uc" style={{ fontSize:7,color:'var(--col-stby)',padding:'1px 4px',border:'1px dashed var(--col-stby)',borderRadius:2 }}>STBY</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Drawer/>
    </ArtboardShell>
  );
}

window.WeeklyBoard = WeeklyBoard;
