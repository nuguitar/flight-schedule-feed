// Shared tokens, context, helpers and components
const { useState, useMemo, useEffect, useRef, useCallback, createContext, useContext } = React;

// ─── Data ────────────────────────────────────────────────────────────────
const FLIGHTS     = window.FLIGHT_DATA.flights;
const INSTRUCTORS = window.FLIGHT_DATA.instructors;
const RESOURCES   = window.FLIGHT_DATA.resources;
const LEAVES      = window.FLIGHT_DATA.leaves;
const HIGHLIGHT_BATCH = 'AP-127';

// Fill in every calendar day between first and last flight date
const ALL_DATES = (() => {
  const src = [...new Set(FLIGHTS.map(f => f.date))].sort();
  if (src.length < 2) return src;
  const result = [];
  let cur = new Date(src[0] + 'T00:00:00Z');
  const last = new Date(src[src.length - 1] + 'T00:00:00Z');
  while (cur <= last) {
    result.push(cur.toISOString().slice(0,10));
    cur = new Date(cur.getTime() + 86400000);
  }
  return result;
})();

// Default to today if available, else nearest future date
const DEFAULT_DATE = (() => {
  const today = new Date().toISOString().slice(0,10);
  if (ALL_DATES.includes(today)) return today;
  return ALL_DATES.find(d => d >= today) || ALL_DATES[ALL_DATES.length - 1];
})();

const PARTS    = d => d.split('-').map(Number);
const fmtDay   = d => {
  const [y, m, day] = PARTS(d);
  const dt = new Date(Date.UTC(y, m-1, day));
  const wd = ['SUN','MON','TUE','WED','THU','FRI','SAT'][dt.getUTCDay()];
  const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][m-1];
  return { wd, mo, day, y };
};
const minutesOf = hhmm => { if (!hhmm) return null; const [h,m]=hhmm.split(':').map(Number); return h*60+m; };
const fmtHM     = hhmm => hhmm || '—';
const isPast    = d => d < new Date().toISOString().slice(0,10);
const isToday   = d => d === new Date().toISOString().slice(0,10);

// ─── Color system ─────────────────────────────────────────────────────────
const STATUS_COLOR = f => {
  if (f.isSim)      return 'var(--col-sim)';
  if (f.isStandby)  return 'var(--col-stby)';
  if (f.status === 'Completed') return 'var(--col-done)';
  if (f.status === 'Canceled')  return 'var(--col-cancel)';
  return 'var(--col-pending)';
};

const flightAlpha = (f, hlOn) => hlOn && f.batch !== HIGHLIGHT_BATCH ? 0.22 : 1;

const STATUS = {
  Pending:   { fg: 'var(--col-pending)', bg: 'var(--col-pending-bg)',  label: 'PENDING'   },
  Completed: { fg: 'var(--col-done)',    bg: 'var(--col-done-bg)',     label: 'COMPLETED' },
  Canceled:  { fg: 'var(--col-cancel)', bg: 'var(--col-cancel-bg)',   label: 'CANCELED'  },
};

// ─── Theme CSS ────────────────────────────────────────────────────────────
const THEME_CSS = `
  :root, body[data-theme="cockpit"] {
    --bg:       oklch(0.16 0.012 245);
    --bg-2:     oklch(0.20 0.013 245);
    --surface:  oklch(0.22 0.014 245);
    --line:     oklch(0.32 0.018 245);
    --line-soft:oklch(0.27 0.014 245);
    --ink:      oklch(0.96 0.01  245);
    --ink-2:    oklch(0.78 0.012 245);
    --ink-3:    oklch(0.58 0.014 245);
    --col-pending:    oklch(0.83 0.13  75);
    --col-pending-bg: oklch(0.30 0.06  75 / 0.45);
    --col-done:       oklch(0.80 0.13 145);
    --col-done-bg:    oklch(0.28 0.06 145 / 0.45);
    --col-cancel:     oklch(0.68 0.14  25);
    --col-cancel-bg:  oklch(0.26 0.06  25 / 0.45);
    --col-sim:        oklch(0.78 0.13 320);
    --col-stby:       oklch(0.70 0.13 255);
    --highlight:      oklch(0.78 0.13 320);
    --highlight-bg:   oklch(0.30 0.10 320 / 0.55);
    --shadow: 0 6px 24px oklch(0 0 0 / 0.4);
  }
  body[data-theme="light"] {
    --bg:       oklch(0.985 0.005 80);
    --bg-2:     oklch(0.965 0.006 80);
    --surface:  oklch(1 0 0);
    --line:     oklch(0.86 0.008 80);
    --line-soft:oklch(0.92 0.006 80);
    --ink:      oklch(0.18 0.01  260);
    --ink-2:    oklch(0.40 0.012 260);
    --ink-3:    oklch(0.56 0.012 260);
    --col-pending:    oklch(0.52 0.13  60);
    --col-pending-bg: oklch(0.94 0.06  75);
    --col-done:       oklch(0.45 0.13 145);
    --col-done-bg:    oklch(0.94 0.06 145);
    --col-cancel:     oklch(0.45 0.14  25);
    --col-cancel-bg:  oklch(0.94 0.05  25);
    --col-sim:        oklch(0.50 0.16 330);
    --col-stby:       oklch(0.45 0.13 255);
    --highlight:      oklch(0.45 0.16 330);
    --highlight-bg:   oklch(0.95 0.06 330);
    --shadow: 0 4px 14px oklch(0 0 0 / 0.07);
  }
  body[data-theme="board"] {
    --bg:       oklch(0.06 0 0);
    --bg-2:     oklch(0.10 0 0);
    --surface:  oklch(0.10 0 0);
    --line:     oklch(0.22 0.01 60);
    --line-soft:oklch(0.16 0.005 60);
    --ink:      oklch(0.96 0.06 75);
    --ink-2:    oklch(0.78 0.10 75);
    --ink-3:    oklch(0.55 0.08 75);
    --col-pending:    oklch(0.85 0.18  75);
    --col-pending-bg: oklch(0.18 0.06  75);
    --col-done:       oklch(0.85 0.18 130);
    --col-done-bg:    oklch(0.18 0.06 130);
    --col-cancel:     oklch(0.70 0.18  25);
    --col-cancel-bg:  oklch(0.20 0.06  25);
    --col-sim:        oklch(0.82 0.18 350);
    --col-stby:       oklch(0.70 0.16 255);
    --highlight:      oklch(0.82 0.18 320);
    --highlight-bg:   oklch(0.22 0.06 320);
    --shadow: 0 0 0 1px oklch(0.22 0.01 60), 0 8px 30px oklch(0 0 0 / 0.6);
  }
  body { background: var(--bg); color: var(--ink); }
  .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-feature-settings: 'tnum' 1, 'zero' 1; }
  .num  { font-variant-numeric: tabular-nums; }
  .uc   { text-transform: uppercase; letter-spacing: 0.06em; }
`;

// ─── App Context ──────────────────────────────────────────────────────────
const AppCtx = createContext(null);
const useApp  = () => useContext(AppCtx);

function AppProvider({ children, tweaks, setTweak, isMobile=false }) {
  const [date, setDate]               = useState(DEFAULT_DATE);
  const [filters, setFilters]         = useState({ batch:'ALL', instructor:'ALL', tail:'ALL', status:'ALL', search:'' });
  const [drawer, setDrawer]           = useState(null);
  const [highlightAP127, setHighlightAP127] = useState(true);
  const [hideOthers, setHideOthers]   = useState(false);

  useEffect(() => { document.body.dataset.theme = tweaks.theme || 'cockpit'; }, [tweaks.theme]);

  const dayFlights = useMemo(() => {
    return FLIGHTS.filter(x => {
      if (x.date !== date) return false;
      if (!tweaks.showSim     && x.isSim)     return false;
      if (!tweaks.showStandby && x.isStandby) return false;
      if (filters.batch      !== 'ALL' && x.batch      !== filters.batch)      return false;
      if (filters.instructor !== 'ALL' && x.instructor !== filters.instructor) return false;
      if (filters.tail       !== 'ALL' && x.tail       !== filters.tail)       return false;
      if (filters.status === 'Standby') { if (!x.isStandby) return false; }
      else if (filters.status !== 'ALL' && x.status !== filters.status)        return false;
      if (hideOthers && highlightAP127 && x.batch !== HIGHLIGHT_BATCH)         return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = [x.student, x.instructor, x.batch, x.lesson, x.tail, x.type].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [date, filters, tweaks.showSim, tweaks.showStandby, hideOthers, highlightAP127]);

  const value = {
    date, setDate, filters, setFilters,
    drawer, setDrawer,
    highlightAP127, setHighlightAP127,
    hideOthers, setHideOthers,
    tweaks, setTweak: setTweak || (() => {}),
    dayFlights,
    flightById: id => FLIGHTS.find(f => f.id === id),
    isMobile,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

// ─── Small atoms ─────────────────────────────────────────────────────────
function ThemeStyle() { return <style dangerouslySetInnerHTML={{ __html: THEME_CSS }}/>; }

function ArtboardShell({ children, style }) {
  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'var(--bg)', color:'var(--ink)', fontFamily:'"Inter",system-ui,sans-serif', overflow:'hidden', ...style }}>
      {children}
    </div>
  );
}

function FlightDot({ f }) {
  const c = STATUS_COLOR(f);
  return (
    <span title={f.status} style={{
      display:'inline-block', width:7, height:7, borderRadius:2,
      background: c, boxShadow:`0 0 6px color-mix(in oklch,${c} 55%,transparent)`,
      flexShrink: 0,
    }}/>
  );
}

function ConditionTag({ cond }) {
  if (!cond) return null;
  return (
    <span className="mono uc" style={{
      fontSize:9, color:'var(--ink-3)', padding:'1px 5px',
      borderRadius:3, border:'1px solid var(--line-soft)', whiteSpace:'nowrap',
    }}>{cond}</span>
  );
}

function StatusPill({ status, size='sm' }) {
  const s = STATUS[status] || STATUS.Pending;
  const pad = size==='lg' ? '4px 10px' : '2px 7px';
  const fs  = size==='lg' ? 11 : 10;
  return (
    <span className="mono uc" style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:pad, borderRadius:999,
      background:s.bg, color:s.fg, fontSize:fs, fontWeight:600,
      border:`1px solid color-mix(in oklch,${s.fg} 30%,transparent)`,
    }}>
      <span style={{ width:6,height:6,borderRadius:999,background:s.fg,boxShadow:`0 0 6px ${s.fg}`,flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

function Tag({ children, color='var(--ink-2)', filled=false, mono=true }) {
  return (
    <span className={mono?'mono uc':'uc'} style={{
      display:'inline-flex', alignItems:'center',
      padding:'2px 7px', borderRadius:4, fontSize:10,
      color: filled?'var(--bg)':color,
      background: filled?color:'transparent',
      border: filled?'none':`1px solid color-mix(in oklch,${color} 35%,transparent)`,
      whiteSpace:'nowrap',
    }}>{children}</span>
  );
}

function StandbyTag({ size='sm' }) {
  const fs  = size==='lg' ? 11 : 10;
  const pad = size==='lg' ? '3px 9px' : '2px 6px';
  return (
    <span className="mono uc" style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:pad, borderRadius:4, fontSize:fs, fontWeight:600,
      color:'var(--col-stby)',
      background:'color-mix(in oklch,var(--col-stby) 10%,transparent)',
      border:'1px dashed color-mix(in oklch,var(--col-stby) 55%,transparent)',
      whiteSpace:'nowrap',
    }}>◌ STBY</span>
  );
}

function HighlightBar({ on }) {
  if (!on) return null;
  return <span style={{
    position:'absolute', left:0, top:6, bottom:6, width:3,
    background:'var(--highlight)', boxShadow:'0 0 10px var(--highlight)', borderRadius:2,
  }}/>;
}

// ─── Date Strip ───────────────────────────────────────────────────────────
function DateStrip({ compact=false }) {
  const { date, setDate, isMobile } = useApp();
  const [expanded, setExpanded] = useState(true);
  // Collapse by default on mobile; re-collapse when switching to mobile
  useEffect(() => { if (isMobile) setExpanded(false); }, [isMobile]);
  const today = new Date().toISOString().slice(0,10);
  const { wd: selWd, day: selDay, mo: selMo } = fmtDay(date);

  if (!expanded) {
    return (
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button onClick={() => setDate(date)} className="mono"
          style={{
            padding:'4px 8px', border:'1px solid var(--col-pending)',
            background:'color-mix(in oklch,var(--col-pending) 14%,var(--surface))',
            color:'var(--ink)', borderRadius:6, cursor:'default',
            display:'flex', flexDirection:'row', alignItems:'center', gap:6,
          }}>
          <span className="mono uc" style={{ fontSize:8, color:'var(--ink-3)' }}>{selWd}</span>
          <span className="num" style={{ fontSize:15, fontWeight:600 }}>{String(selDay).padStart(2,'0')}</span>
          <span className="mono uc" style={{ fontSize:8, color:'var(--ink-3)' }}>{selMo}</span>
        </button>
        <button onClick={() => setExpanded(true)} className="mono uc" style={{
          fontSize:9, padding:'4px 8px', borderRadius:4, border:'1px solid var(--line)',
          background:'transparent', color:'var(--ink-3)', cursor:'pointer',
        }}>ALL DATES ▾</button>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', gap:5, alignItems:'stretch', flexWrap:'wrap' }}>
      {ALL_DATES.map(d => {
        const sel  = d === date;
        const past = d < today;
        const tod  = d === today;
        const { wd, day } = fmtDay(d);
        return (
          <button key={d} onClick={() => setDate(d)} className="mono"
            style={{
              minWidth: compact?36:44, padding: compact?'3px 6px':'5px 8px',
              border:`1px solid ${sel?'var(--col-pending)':'var(--line)'}`,
              background: sel?'color-mix(in oklch,var(--col-pending) 14%,var(--surface))':'var(--surface)',
              color: sel?'var(--ink)': past?'var(--ink-3)':'var(--ink-2)',
              borderRadius:6, cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              opacity: past&&!sel ? 0.45 : 1,
              boxShadow: sel?'0 0 0 1px var(--col-pending),0 0 12px color-mix(in oklch,var(--col-pending) 30%,transparent)':'none',
              transition:'all .12s ease', position:'relative',
            }}>
            <span style={{ fontSize:8, opacity:.7 }}>{wd}</span>
            <span style={{ fontSize:compact?13:15, fontWeight:600, color:'var(--ink)' }}>{String(day).padStart(2,'0')}</span>
            {tod && <span style={{ width:4,height:4,borderRadius:999,background:'var(--col-pending)',position:'absolute',bottom:4 }}/>}
          </button>
        );
      })}
      <button onClick={() => setExpanded(false)} className="mono uc"
        style={{ fontSize:8, padding:'4px 6px', borderRadius:4, border:'1px solid var(--line)', background:'transparent', color:'var(--ink-3)', cursor:'pointer', alignSelf:'center' }}>
        ▲
      </button>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────
function FilterBar() {
  const { filters, setFilters } = useApp();
  const batches     = useMemo(()=>['ALL',...new Set(FLIGHTS.map(f=>f.batch))],[]);
  const instructors = useMemo(()=>['ALL',...new Set(FLIGHTS.map(f=>f.instructor).filter(Boolean))].sort(),[]);
  const tails       = useMemo(()=>['ALL',...new Set(FLIGHTS.map(f=>f.tail).filter(Boolean))].sort(),[]);

  const Sel = ({label,val,opts,k}) => (
    <label style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <span className="mono uc" style={{ fontSize:9, color:'var(--ink-3)' }}>{label}</span>
      <select className="mono" value={val} onChange={e=>setFilters(f=>({...f,[k]:e.target.value}))}
        style={{ background:'var(--surface)', color:'var(--ink)', border:'1px solid var(--line)', borderRadius:4, padding:'4px 8px', fontSize:11, minWidth:100, outline:'none' }}>
        {opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
      <label style={{ display:'flex', flexDirection:'column', gap:3, flex:'1 1 200px', minWidth:170 }}>
        <span className="mono uc" style={{ fontSize:9, color:'var(--ink-3)' }}>SEARCH</span>
        <div style={{ position:'relative' }}>
          <input value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}
            placeholder="student / lesson / tail…"
            style={{ width:'100%', background:'var(--surface)', color:'var(--ink)', border:'1px solid var(--line)', borderRadius:4, padding:'4px 10px 4px 26px', fontSize:11, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
          <span style={{ position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--ink-3)',fontSize:12 }}>⌕</span>
        </div>
      </label>
      <Sel label="BATCH"      val={filters.batch}      k="batch"      opts={batches}/>
      <Sel label="INSTRUCTOR" val={filters.instructor} k="instructor" opts={instructors}/>
      <Sel label="AIRCRAFT"   val={filters.tail}       k="tail"       opts={tails}/>
      <Sel label="STATUS"     val={filters.status}     k="status"     opts={['ALL','Pending','Completed','Canceled','Standby']}/>
    </div>
  );
}

// ─── Inline Settings bar ──────────────────────────────────────────────────
function InlineSettings({ gantt=false }) {
  const { tweaks, setTweak, highlightAP127, setHighlightAP127, hideOthers, setHideOthers } = useApp();
  const Chip = ({ on, onClick, children, color='var(--ink-2)' }) => (
    <button onClick={onClick} className="mono uc" style={{
      padding:'4px 10px', fontSize:10, borderRadius:4, cursor:'pointer',
      border:`1px solid ${on?color:'var(--line)'}`,
      background: on?`color-mix(in oklch,${color} 14%,var(--surface))`:'transparent',
      color: on?color:'var(--ink-3)', fontWeight: on?600:400, transition:'all .1s',
    }}>{children}</button>
  );
  return (
    <div style={{
      padding:'4px 24px', borderBottom:'1px solid var(--line-soft)',
      background:'var(--bg-2)', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap',
      flexShrink:0,
    }}>
      <span className="mono uc" style={{ fontSize:9, color:'var(--ink-3)' }}>THEME</span>
      {['cockpit','light','board'].map(th=>(
        <Chip key={th} on={tweaks.theme===th} onClick={()=>setTweak('theme',th)} color="var(--ink-2)">{th}</Chip>
      ))}
      <div style={{ width:1,height:16,background:'var(--line)',margin:'0 4px' }}/>
      <Chip on={highlightAP127} onClick={()=>setHighlightAP127(v=>!v)} color="var(--highlight)">◆ AP-127 FOCUS</Chip>
      <span style={{opacity:highlightAP127?1:0.35,transition:'opacity .15s'}}>
        <Chip on={hideOthers} onClick={()=>setHideOthers(v=>!v)} color="var(--highlight)">HIDE OTHERS</Chip>
      </span>
      <Chip on={tweaks.showSim}     onClick={()=>setTweak('showSim',!tweaks.showSim)}         color="var(--col-sim)">SIM</Chip>
      <Chip on={tweaks.showStandby} onClick={()=>setTweak('showStandby',!tweaks.showStandby)} color="var(--col-stby)">STBY</Chip>
      {gantt && <>
        <div style={{ width:1,height:16,background:'var(--line)',margin:'0 4px' }}/>
        <span className="mono uc" style={{ fontSize:9, color:'var(--ink-3)' }}>GROUP</span>
        {['instructor','tail','batch'].map(g=>(
          <Chip key={g} on={tweaks.groupBy===g} onClick={()=>setTweak('groupBy',g)} color="var(--ink-2)">{g}</Chip>
        ))}
      </>}
    </div>
  );
}

// ─── (sidebar resize is handled directly in App in index.html) ───────────

// ─── Drawer (view-only) ───────────────────────────────────────────────────
function Drawer() {
  const { drawer, setDrawer, flightById } = useApp();
  if (!drawer) return null;
  const f = flightById(drawer);
  if (!f) return null;
  const isHL  = f.batch === HIGHLIGHT_BATCH;
  const color = STATUS_COLOR(f);
  const Row   = ({ k, v }) => (
    <div style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:12, padding:'8px 0', borderBottom:'1px solid var(--line-soft)' }}>
      <div className="mono uc" style={{ fontSize:10, color:'var(--ink-3)' }}>{k}</div>
      <div style={{ fontSize:13, color:'var(--ink)' }}>{v ?? <span style={{color:'var(--ink-3)'}}>—</span>}</div>
    </div>
  );
  return (
    <div onClick={()=>setDrawer(null)} style={{
      position:'absolute', inset:0, background:'oklch(0 0 0 / 0.45)',
      display:'flex', justifyContent:'flex-end', zIndex:50, backdropFilter:'blur(2px)',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:380, height:'100%', background:'var(--surface)',
        borderLeft:'1px solid var(--line)', boxShadow:'-12px 0 30px oklch(0 0 0 / 0.35)',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{ height:3, background:color, opacity:.9 }}/>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div className="mono uc" style={{ fontSize:10, color:'var(--ink-3)', marginBottom:4 }}>FLIGHT · {f.id}</div>
            <div style={{ fontSize:22, fontWeight:600, lineHeight:1.1 }}>{f.student||'—'}</div>
            <div className="mono" style={{ fontSize:11, color:'var(--ink-2)', marginTop:4 }}>{f.batch} · {f.lesson}</div>
          </div>
          <button onClick={()=>setDrawer(null)} style={{ background:'transparent',color:'var(--ink-2)',border:'none',cursor:'pointer',fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:'8px 20px', flex:1, overflowY:'auto' }}>
          <div style={{ display:'flex', gap:8, padding:'12px 0', flexWrap:'wrap' }}>
            <StatusPill status={f.status} size="lg"/>
            {f.isStandby && <StandbyTag size="lg"/>}
            {f.isSim     && <Tag color="var(--col-sim)">SIM</Tag>}
            {isHL        && <Tag color="var(--highlight)" filled>AP-127</Tag>}
          </div>
          <Row k="TIME"       v={<span className="mono">{f.start} — {f.end} · {f.duration}</span>}/>
          <Row k="DURATION"   v={<span className="mono">{Math.floor(f.durMin/60)}h {f.durMin%60}m</span>}/>
          <Row k="STUDENT"    v={f.student}/>
          <Row k="INSTRUCTOR" v={f.instructor}/>
          <Row k="BATCH"      v={<span className="mono">{f.batch}</span>}/>
          <Row k="LESSON"     v={<span className="mono">{f.lesson}</span>}/>
          <Row k="CONDITION"  v={f.cond}/>
          {f.isStandby && <Row k="STANDBY" v={<span style={{color:'var(--col-stby)'}}>Waiting for slot to open</span>}/>}
          <Row k="A/C TYPE"   v={<span className="mono">{f.type}</span>}/>
          <Row k="TAIL"       v={<span className="mono" style={{ display:'inline-block',padding:'2px 8px',borderRadius:3,background:'var(--bg-2)',border:'1px solid var(--line)' }}>{f.tail||'TBD'}</span>}/>
          {f.status === 'Completed' && (f.tkoff || f.ldgTime || f.airborne) && (
            <Row k="ACTUAL TIMES" v={
              <span className="mono" style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {f.tkoff   && <span style={{color:'var(--ink-2)'}}>T/O <strong>{f.tkoff}</strong></span>}
                {f.ldgTime && <span style={{color:'var(--ink-2)'}}>LDG <strong>{f.ldgTime}</strong></span>}
                {f.airborne && <span style={{color:'var(--ink-3)'}}>AIR <strong>{f.airborne}</strong></span>}
              </span>
            }/>
          )}
          {f.status === 'Completed' && (f.to != null || f.ldg != null || f.inst != null) && (
            <Row k="T/O · LDG · INST" v={
              <span className="mono" style={{ display:'flex', gap:16 }}>
                <span><span style={{color:'var(--ink-3)',fontSize:10}}>T/O</span> <strong style={{fontSize:15}}>{f.to ?? '—'}</strong></span>
                <span><span style={{color:'var(--ink-3)',fontSize:10}}>LDG</span> <strong style={{fontSize:15}}>{f.ldg ?? '—'}</strong></span>
                <span><span style={{color:'var(--ink-3)',fontSize:10}}>INST</span> <strong style={{fontSize:15}}>{f.inst ?? '—'}</strong></span>
              </span>
            }/>
          )}
        </div>
        <div className="mono uc" style={{ padding:'10px 20px', fontSize:9, color:'var(--ink-3)', borderTop:'1px solid var(--line-soft)', textAlign:'center' }}>
          VIEW ONLY · CLICK OUTSIDE TO CLOSE
        </div>
      </div>
    </div>
  );
}

// ─── View icons ───────────────────────────────────────────────────────────
function ViewIcon({ id, size=13, color='currentColor' }) {
  if (id === 'board') return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill={color}>
      <rect x="1" y="1" width="5" height="5" rx="1" opacity=".85"/>
      <rect x="8" y="1" width="5" height="5" rx="1" opacity=".85"/>
      <rect x="1" y="8" width="5" height="5" rx="1" opacity=".85"/>
      <rect x="8" y="8" width="5" height="5" rx="1" opacity=".85"/>
    </svg>
  );
  if (id === 'gantt') return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill={color}>
      <rect x="2" y="1.5" width="8" height="2.5" rx="1"/>
      <rect x="5" y="5.5" width="7" height="2.5" rx="1" opacity=".75"/>
      <rect x="1" y="9.5" width="10" height="2.5" rx="1" opacity=".55"/>
      <rect x="1" y="1" width="1.5" height="12" rx=".5" opacity=".3"/>
    </svg>
  );
  if (id === 'weekly') return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3">
      <rect x="1.5" y="3" width="11" height="9.5" rx="1"/>
      <line x1="1.5" y1="6" x2="12.5" y2="6"/>
      <line x1="5.2" y1="3" x2="5.2" y2="12.5"/>
      <line x1="8.8" y1="3" x2="8.8" y2="12.5"/>
      <line x1="4" y1="1" x2="4" y2="3.5"/>
      <line x1="10" y1="1" x2="10" y2="3.5"/>
    </svg>
  );
  if (id === 'summary') return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill={color}>
      <path d="M7 7L7 1.2A5.8 5.8 0 0 1 12.8 7Z" opacity=".9"/>
      <path d="M7 7L1.2 7A5.8 5.8 0 0 1 7 1.2Z" opacity=".55"/>
      <path d="M7 7L12.8 7A5.8 5.8 0 0 1 3.2 11.4Z" opacity=".35"/>
    </svg>
  );
  if (id === 'roster') return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill={color}>
      <rect x="1"   y="4.5" width="3.5" height="2"   rx=".4" opacity=".9"/>
      <rect x="5.5" y="4.5" width="3.5" height="2"   rx=".4" opacity=".5"/>
      <rect x="10"  y="4.5" width="3.5" height="2"   rx=".4" opacity=".7"/>
      <rect x="1"   y="7.5" width="3.5" height="2"   rx=".4" opacity=".5"/>
      <rect x="5.5" y="7.5" width="3.5" height="2"   rx=".4" opacity=".9"/>
      <rect x="10"  y="7.5" width="3.5" height="2"   rx=".4" opacity=".4"/>
      <rect x="1"   y="10.5" width="3.5" height="2"  rx=".4" opacity=".3"/>
      <rect x="5.5" y="10.5" width="3.5" height="2"  rx=".4" opacity=".6"/>
      <rect x="10"  y="10.5" width="3.5" height="2"  rx=".4" opacity=".8"/>
      <line x1="1" y1="3.5" x2="13" y2="3.5" stroke={color} strokeWidth="1" opacity=".5"/>
    </svg>
  );
  return null;
}

// ─── Focus controls (AP-127 highlight + hide-others, shown in view headers) ──
function FocusControls() {
  const { highlightAP127, setHighlightAP127, hideOthers, setHideOthers } = useApp();
  const Chip = ({ on, onClick, children, color }) => (
    <button onClick={onClick} className="mono uc" style={{
      padding:'3px 8px', fontSize:9, borderRadius:4, cursor:'pointer',
      border:`1px solid ${on ? color : 'var(--line)'}`,
      background: on ? `color-mix(in oklch,${color} 14%,var(--surface))` : 'transparent',
      color: on ? color : 'var(--ink-3)', fontWeight: on ? 600 : 400, transition:'all .1s',
      whiteSpace:'nowrap',
    }}>{children}</button>
  );
  return (
    <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
      <Chip on={highlightAP127} onClick={()=>setHighlightAP127(v=>!v)} color="var(--highlight)">◆ AP-127</Chip>
      <span style={{ opacity: highlightAP127 ? 1 : 0.35, transition:'opacity .15s' }}>
        <Chip on={hideOthers} onClick={()=>setHideOthers(v=>!v)} color="var(--highlight)">HIDE</Chip>
      </span>
    </div>
  );
}

Object.assign(window, {
  AppCtx, AppProvider, useApp, ThemeStyle, ArtboardShell,
  FLIGHTS, INSTRUCTORS, RESOURCES, LEAVES, ALL_DATES, DEFAULT_DATE, HIGHLIGHT_BATCH,
  fmtDay, minutesOf, fmtHM, isPast, isToday, STATUS_COLOR, flightAlpha, STATUS,
  FlightDot, ConditionTag, StatusPill, Tag, StandbyTag, HighlightBar,
  DateStrip, FilterBar, InlineSettings, Drawer,
  ViewIcon, FocusControls,
});

