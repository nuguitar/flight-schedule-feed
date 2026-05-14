// Day at a Glance — comprehensive single-day dashboard
// Shows all flight aspects for one date: KPIs, hourly schedule pulse, status mix,
// batch breakdown, instructor & fleet utilization, plus a dedicated AP-127 spotlight.
const { useMemo: useM_d, useState: useS_d } = React;

// Helpers --------------------------------------------------------------------
const hmToMin_d = hm => {
  if (!hm) return 0;
  const [h, m] = String(hm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hoursFmt = h => h >= 10 ? h.toFixed(0) : h.toFixed(1);

// Inline SVG donut (kept local so this view is self-contained)
function DailyDonut({ slices, size = 150, ring = 22, center }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r  = (size - ring) / 2;
  const cx = size / 2, cy = size / 2;
  const C  = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={ring} opacity={0.25}/>
        {total > 0 && slices.map(s => {
          const frac = s.value / total;
          if (frac === 0) return null;
          const dash = frac * C, gap = C - dash;
          const el = (
            <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={ring}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-off * C} opacity={0.9}
              strokeLinecap="butt"/>
          );
          off += frac;
          return el;
        })}
      </svg>
      {/* Center label */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {total === 0 ? (
          <span className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)' }}>NO DATA</span>
        ) : (
          center || (
            <>
              <span className="num" style={{ fontSize: size > 130 ? 26 : 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{total}</span>
              <span className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2 }}>FLIGHTS</span>
            </>
          )
        )}
      </div>
    </div>
  );
}

// KPI tile
function DKPI({ label, value, sub, color, big = false, small = false }) {
  return (
    <div style={{
      flex: small ? '1 1 78px' : '1 1 110px',
      minWidth: small ? 66 : 84,
      padding: big ? '10px 14px' : (small ? '6px 8px' : '8px 12px'),
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 6, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }}/>
      <div className="mono uc" style={{ fontSize: small ? 7 : 8, color: 'var(--ink-3)' }}>{label}</div>
      <div className="num" style={{
        fontSize: big ? 28 : (small ? 17 : 22), fontWeight: 700, lineHeight: 1.05, marginTop: 2,
        color: 'var(--ink)',
      }}>{value}</div>
      {sub && <div className="mono uc" style={{ fontSize: 8, color: 'var(--ink-3)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// Section card
function Section({ title, hint, accent, children, fullWidth = false }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 8, overflow: 'hidden',
      gridColumn: fullWidth ? '1 / -1' : 'auto',
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--line)',
        background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 8,
        borderLeft: accent ? `3px solid ${accent}` : 'none',
      }}>
        <div className="mono uc" style={{ fontSize: 10, color: 'var(--ink)', fontWeight: 600 }}>{title}</div>
        {hint && <div className="mono uc" style={{ fontSize: 8, color: 'var(--ink-3)', marginLeft: 'auto' }}>{hint}</div>}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

// Mini-progress bar (used in batch / instructor / aircraft rows)
function StackBar({ pending = 0, completed = 0, canceled = 0, standby = 0, max = 1, total }) {
  const t = total ?? (pending + completed + canceled + standby);
  const width = `${Math.max(2, (t / max) * 100).toFixed(1)}%`;
  return (
    <div style={{ flex: 1, height: 16, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width, height: '100%', display: 'flex', gap: 1, transition: 'width .25s' }}>
        {pending   > 0 && <div title={`Pending: ${pending}`}     style={{ flex: pending,   background: 'var(--col-pending)', opacity: .85 }}/>}
        {completed > 0 && <div title={`Completed: ${completed}`} style={{ flex: completed, background: 'var(--col-done)',    opacity: .85 }}/>}
        {canceled  > 0 && <div title={`Canceled: ${canceled}`}   style={{ flex: canceled,  background: 'var(--col-cancel)',  opacity: .85 }}/>}
        {standby   > 0 && <div title={`Standby: ${standby}`}     style={{ flex: standby,   background: 'var(--col-stby)',    opacity: .85 }}/>}
        {t === 0       && <div style={{ flex: 1, background: 'var(--line)', opacity: .2 }}/>}
      </div>
    </div>
  );
}

function DailyBoard() {
  const app = useApp();
  const { isMobile } = app;
  const date = app.date;
  const today = localToday();
  const isCurrentDay = date === today;
  const { wd, mo, day, y } = fmtDay(date);

  // Source of truth — all flights for the selected date (no filters applied here)
  const flights = useM_d(() => FLIGHTS.filter(f => f.date === date), [date]);

  // Comprehensive day stats
  const stats = useM_d(() => {
    const s = {
      total: 0, pending: 0, completed: 0, canceled: 0,
      standby: 0, sim: 0, ap127: 0,
      schedHours: 0, flownHours: 0,
      students: new Set(), instructors: new Set(), tails: new Set(), batches: new Set(),
      // Mutually-exclusive buckets for the donut (matches STATUS_COLOR precedence)
      mix: { sim: 0, standby: 0, completed: 0, pending: 0, canceled: 0 },
    };
    flights.forEach(f => {
      s.total++;
      // Overlapping counters (consistent with the BOARD view's stat tiles)
      if (f.status === 'Pending')   s.pending++;
      if (f.status === 'Completed') s.completed++;
      if (f.status === 'Canceled')  s.canceled++;
      if (f.isStandby) s.standby++;
      if (f.isSim)     s.sim++;
      if (f.batch === HIGHLIGHT_BATCH) s.ap127++;
      // Mutually-exclusive bucket — each flight counted exactly once
      if (f.isSim)                       s.mix.sim++;
      else if (f.isStandby)              s.mix.standby++;
      else if (f.status === 'Completed') s.mix.completed++;
      else if (f.status === 'Canceled')  s.mix.canceled++;
      else                               s.mix.pending++;
      s.schedHours += (f.durMin || 0) / 60;
      if (f.status === 'Completed') {
        const minutes = f.airborne ? hmToMin_d(f.airborne) : (f.durMin || 0);
        s.flownHours += minutes / 60;
      }
      if (f.student)    s.students.add(f.student);
      if (f.instructor) s.instructors.add(f.instructor);
      if (f.tail)       s.tails.add(f.tail);
      if (f.batch)      s.batches.add(f.batch);
    });
    const scheduledOutcome = s.completed + s.canceled;
    s.completionRate = scheduledOutcome > 0 ? (s.completed / scheduledOutcome) * 100 : null;
    return s;
  }, [flights]);

  // Hourly schedule pulse (06–21)
  const hourly = useM_d(() => {
    const HOURS = [];
    for (let h = 6; h <= 21; h++) HOURS.push(h);
    const buckets = Object.fromEntries(HOURS.map(h => [h, { total: 0, completed: 0, ap127: 0 }]));
    flights.forEach(f => {
      const m = minutesOf(f.start); if (m == null) return;
      const h = Math.floor(m / 60);
      if (!buckets[h]) return;
      buckets[h].total++;
      if (f.status === 'Completed') buckets[h].completed++;
      if (f.batch === HIGHLIGHT_BATCH) buckets[h].ap127++;
    });
    const max = Math.max(1, ...HOURS.map(h => buckets[h].total));
    return { HOURS, buckets, max };
  }, [flights]);

  // Batch breakdown
  const byBatch = useM_d(() => {
    const m = {};
    flights.forEach(f => {
      const b = f.batch || '—';
      if (!m[b]) m[b] = { name: b, total: 0, pending: 0, completed: 0, canceled: 0, standby: 0, hours: 0 };
      m[b].total++;
      if (f.status === 'Pending')   m[b].pending++;
      if (f.status === 'Completed') m[b].completed++;
      if (f.status === 'Canceled')  m[b].canceled++;
      if (f.isStandby) m[b].standby++;
      m[b].hours += (f.durMin || 0) / 60;
    });
    return Object.values(m).sort((a, b) => {
      // AP-127 always first if present
      if (a.name === HIGHLIGHT_BATCH) return -1;
      if (b.name === HIGHLIGHT_BATCH) return 1;
      return b.total - a.total;
    });
  }, [flights]);

  // Top instructors (by flights), with completion %
  const byInstructor = useM_d(() => {
    const m = {};
    flights.forEach(f => {
      if (!f.instructor) return;
      const k = f.instructor;
      if (!m[k]) m[k] = { name: k, total: 0, completed: 0, canceled: 0, hours: 0, ap127: 0 };
      m[k].total++;
      if (f.status === 'Completed') m[k].completed++;
      if (f.status === 'Canceled')  m[k].canceled++;
      m[k].hours += (f.durMin || 0) / 60;
      if (f.batch === HIGHLIGHT_BATCH) m[k].ap127++;
    });
    return Object.values(m).sort((a, b) => b.total - a.total || b.hours - a.hours);
  }, [flights]);

  // Aircraft fleet usage (by tail)
  const byTail = useM_d(() => {
    const m = {};
    flights.forEach(f => {
      if (f.isSim) return;
      const k = f.tail || 'TBD';
      if (!m[k]) m[k] = { name: k, type: f.type || '—', total: 0, completed: 0, canceled: 0, hours: 0 };
      m[k].total++;
      if (f.status === 'Completed') m[k].completed++;
      if (f.status === 'Canceled')  m[k].canceled++;
      m[k].hours += (f.durMin || 0) / 60;
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [flights]);

  // AP-127 specific
  const ap127 = useM_d(() => {
    const arr = flights.filter(f => f.batch === HIGHLIGHT_BATCH);
    const s = {
      flights: arr.length, students: new Set(), instructors: new Set(),
      completed: 0, pending: 0, canceled: 0, standby: 0, sim: 0,
      hours: 0, lessons: new Set(),
    };
    arr.forEach(f => {
      if (f.student)    s.students.add(f.student);
      if (f.instructor) s.instructors.add(f.instructor);
      if (f.lesson)     s.lessons.add(f.lesson);
      if (f.status === 'Pending')   s.pending++;
      if (f.status === 'Completed') s.completed++;
      if (f.status === 'Canceled')  s.canceled++;
      if (f.isStandby) s.standby++;
      if (f.isSim)     s.sim++;
      s.hours += (f.durMin || 0) / 60;
    });
    const outcome = s.completed + s.canceled;
    s.completionRate = outcome > 0 ? (s.completed / outcome) * 100 : null;
    // Sort flights by start time
    const sorted = [...arr].sort((a, b) => (minutesOf(a.start) || 0) - (minutesOf(b.start) || 0));
    return { ...s, list: sorted };
  }, [flights]);

  // Compare AP-127 completion rate vs school
  const schoolRate = stats.completionRate;
  const apRate     = ap127.completionRate;

  // Status mix slices for donut — mutually exclusive, sums to stats.total
  const statusSlices = [
    { label: 'Completed', value: stats.mix.completed, color: 'var(--col-done)' },
    { label: 'Pending',   value: stats.mix.pending,   color: 'var(--col-pending)' },
    { label: 'Standby',   value: stats.mix.standby,   color: 'var(--col-stby)' },
    { label: 'Canceled',  value: stats.mix.canceled,  color: 'var(--col-cancel)' },
    { label: 'SIM',       value: stats.mix.sim,        color: 'var(--col-sim)' },
  ].filter(s => s.value > 0);

  const gridCols = isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))';

  return (
    <ArtboardShell style={{ display: 'flex', flexDirection: 'column' }}>
      <ThemeStyle/>

      {/* Top bar */}
      <div style={{
        height: 38, padding: '0 16px', borderBottom: '1px solid var(--line)',
        background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--col-done)', boxShadow: '0 0 8px var(--col-done)', animation: 'pulse 2s ease-in-out infinite' }}/>
          <ViewIcon id="daily" size={12} color="var(--ink-2)"/>
          <div className="mono uc" style={{ fontSize: 11, fontWeight: 600 }}>DAY AT A GLANCE</div>
        </div>
        <div style={{ flex: 1 }}/>
        <div className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)' }}>{flights.length} FLTS · {FLIGHTS.length} TOTAL</div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: isMobile ? '8px' : '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Date hero + DateStrip */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              padding: '8px 14px', background: 'var(--surface)',
              border: `1px solid ${isCurrentDay ? 'var(--col-pending)' : 'var(--line)'}`,
              borderRadius: 8, display: 'flex', alignItems: 'baseline', gap: 8,
              boxShadow: isCurrentDay ? '0 0 0 1px var(--col-pending), 0 0 18px color-mix(in oklch,var(--col-pending) 25%,transparent)' : 'none',
            }}>
              <div className="num" style={{
                fontSize: isMobile ? 34 : 46, fontWeight: 800, lineHeight: 1,
                letterSpacing: '-0.02em', color: 'var(--ink)',
              }}>{String(day).padStart(2, '0')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="mono uc" style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{mo} {y}</div>
                <div className="mono uc" style={{ fontSize: 10, color: isCurrentDay ? 'var(--col-pending)' : 'var(--ink-3)' }}>
                  {wd}{isCurrentDay ? ' · TODAY' : ''}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DateStrip compact/>
            </div>
          </div>

          {/* Hero KPI strip — School performance */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <DKPI label="TOTAL"     value={stats.total}        sub="SCHEDULED" color="var(--col-pending)" small={isMobile}/>
            <DKPI label="COMPLETED" value={stats.completed}    sub={stats.completionRate != null ? `${stats.completionRate.toFixed(0)}% RATE` : '—'} color="var(--col-done)" small={isMobile}/>
            <DKPI label="PENDING"   value={stats.pending}      sub={`${stats.standby} STBY`} color="var(--col-pending)" small={isMobile}/>
            <DKPI label="CANCELED"  value={stats.canceled}     sub="OF SCHED" color="var(--col-cancel)" small={isMobile}/>
            <DKPI label="HOURS"     value={hoursFmt(stats.flownHours)} sub={`${hoursFmt(stats.schedHours)} PLAN`} color="var(--col-done)" small={isMobile}/>
            <DKPI label="SIM"       value={stats.sim}          sub="SIMULATOR" color="var(--col-sim)" small={isMobile}/>
            <DKPI label="A/C USED"  value={stats.tails.size}   sub="AIRCRAFT" color="var(--ink-2)" small={isMobile}/>
            <DKPI label="INSTR"     value={stats.instructors.size} sub="ACTIVE" color="var(--ink-2)" small={isMobile}/>
            <DKPI label="◆ AP-127"  value={stats.ap127}        sub={`${ap127.students.size} STUDENTS`} color="var(--highlight)" small={isMobile}/>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12 }}>
            {/* Schedule Pulse — hourly bar chart */}
            <Section title="SCHEDULE PULSE" hint="FLIGHTS BY HOUR (06–21)">
              {flights.length === 0 ? (
                <div className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)', padding: '20px 0', textAlign: 'center' }}>NO FLIGHTS</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110 }}>
                  {hourly.HOURS.map(h => {
                    const b = hourly.buckets[h];
                    const hPct = b.total / hourly.max;
                    const apPct = b.total > 0 ? b.ap127 / b.total : 0;
                    return (
                      <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                        <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{
                            width: '100%',
                            height: `${Math.max(2, hPct * 100)}%`,
                            background: 'var(--col-pending)',
                            opacity: 0.85,
                            borderRadius: '2px 2px 0 0',
                            position: 'relative',
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                          }} title={`${String(h).padStart(2,'0')}:00 — ${b.total} flights (${b.ap127} AP-127, ${b.completed} done)`}>
                            {apPct > 0 && <div style={{ width: '100%', height: `${apPct * 100}%`, background: 'var(--highlight)', borderRadius: 2 }}/>}
                          </div>
                        </div>
                        <div className="mono num" style={{ fontSize: 8, color: 'var(--ink-3)' }}>{String(h).padStart(2, '0')}</div>
                        {b.total > 0 && <div className="mono num" style={{ fontSize: 8, color: 'var(--ink-2)', fontWeight: 600 }}>{b.total}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mono uc" style={{ fontSize: 8, color: 'var(--ink-3)', display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, background: 'var(--col-pending)', opacity: 0.85, borderRadius: 2 }}/>ALL
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, background: 'var(--highlight)', borderRadius: 2 }}/>AP-127
                </span>
              </div>
            </Section>

            {/* Status Mix donut */}
            <Section title="STATUS MIX" hint="OUTCOME DISTRIBUTION">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                <DailyDonut slices={statusSlices} size={isMobile ? 130 : 150}/>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 140 }}>
                  {[
                    { label: 'COMPLETED', value: stats.mix.completed, color: 'var(--col-done)' },
                    { label: 'PENDING',   value: stats.mix.pending,   color: 'var(--col-pending)' },
                    { label: 'STANDBY',   value: stats.mix.standby,   color: 'var(--col-stby)' },
                    { label: 'CANCELED',  value: stats.mix.canceled,  color: 'var(--col-cancel)' },
                    { label: 'SIM',       value: stats.mix.sim,        color: 'var(--col-sim)' },
                  ].map(s => {
                    const pct = stats.total > 0 ? (s.value / stats.total) * 100 : 0;
                    return (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2, flexShrink: 0 }}/>
                        <span className="mono uc" style={{ fontSize: 9, color: 'var(--ink-2)', flex: 1 }}>{s.label}</span>
                        <span className="mono num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{s.value}</span>
                        <span className="mono num" style={{ fontSize: 9, color: 'var(--ink-3)', width: 36, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Section>
          </div>

          {/* Batch breakdown */}
          <Section title="BATCH BREAKDOWN" hint={`${byBatch.length} BATCH${byBatch.length === 1 ? '' : 'ES'} FLYING`}>
            {byBatch.length === 0 ? (
              <div className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)', padding: '8px 0' }}>NO DATA</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const max = Math.max(...byBatch.map(b => b.total), 1);
                  return byBatch.map(b => {
                    const isHL = b.name === HIGHLIGHT_BATCH;
                    return (
                      <div key={b.name} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div className="mono uc" style={{
                          width: 86, fontSize: 11, flexShrink: 0,
                          color: isHL ? 'var(--highlight)' : 'var(--ink-2)',
                          fontWeight: isHL ? 700 : 500,
                        }}>{isHL ? '◆ ' : ''}{b.name}</div>
                        <StackBar pending={b.pending} completed={b.completed} canceled={b.canceled} standby={b.standby} total={b.total} max={max}/>
                        <div className="mono num" style={{ width: 28, fontSize: 11, color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>{b.total}</div>
                        <div className="mono num" style={{ width: 50, fontSize: 10, color: 'var(--ink-3)', textAlign: 'right' }}>{hoursFmt(b.hours)}h</div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </Section>

          {/* Instructor + Aircraft grid */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12 }}>
            <Section title="INSTRUCTOR LOAD" hint={`${byInstructor.length} INSTRUCTOR${byInstructor.length === 1 ? '' : 'S'}`}>
              {byInstructor.length === 0 ? (
                <div className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)', padding: '8px 0' }}>NO DATA</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                  {(() => {
                    const max = Math.max(...byInstructor.map(i => i.total), 1);
                    return byInstructor.slice(0, 12).map(i => {
                      const rate = (i.completed + i.canceled) > 0 ? (i.completed / (i.completed + i.canceled)) * 100 : null;
                      return (
                        <div key={i.name} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
                          <div style={{
                            width: 110, fontSize: 11, color: 'var(--ink-2)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
                          }} title={i.name}>{i.name}</div>
                          <div style={{ flex: 1, height: 12, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              width: `${(i.total / max) * 100}%`, height: '100%',
                              background: i.ap127 > 0 ? 'var(--highlight)' : 'var(--col-pending)',
                              opacity: 0.85,
                            }}/>
                          </div>
                          <div className="mono num" style={{ width: 22, fontSize: 11, color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>{i.total}</div>
                          <div className="mono num" style={{ width: 38, fontSize: 9, color: 'var(--ink-3)', textAlign: 'right' }}>{hoursFmt(i.hours)}h</div>
                          {rate != null && <div className="mono num" style={{ width: 32, fontSize: 9, color: rate >= 80 ? 'var(--col-done)' : (rate >= 50 ? 'var(--col-pending)' : 'var(--col-cancel)'), textAlign: 'right' }}>{rate.toFixed(0)}%</div>}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </Section>

            <Section title="AIRCRAFT FLEET" hint={`${byTail.length} TAIL${byTail.length === 1 ? '' : 'S'} (ex. SIM)`}>
              {byTail.length === 0 ? (
                <div className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)', padding: '8px 0' }}>NO DATA</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                  {(() => {
                    const max = Math.max(...byTail.map(t => t.total), 1);
                    return byTail.map(t => {
                      const rate = (t.completed + t.canceled) > 0 ? (t.completed / (t.completed + t.canceled)) * 100 : null;
                      return (
                        <div key={t.name} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
                          <div className="mono" style={{ width: 70, fontSize: 11, color: 'var(--ink)', fontWeight: 600, flexShrink: 0 }}>{t.name}</div>
                          <div className="mono" style={{ width: 50, fontSize: 9, color: 'var(--ink-3)', flexShrink: 0 }}>{t.type}</div>
                          <div style={{ flex: 1, height: 12, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${(t.total / max) * 100}%`, height: '100%', background: 'var(--col-pending)', opacity: 0.85 }}/>
                          </div>
                          <div className="mono num" style={{ width: 22, fontSize: 11, color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>{t.total}</div>
                          <div className="mono num" style={{ width: 38, fontSize: 9, color: 'var(--ink-3)', textAlign: 'right' }}>{hoursFmt(t.hours)}h</div>
                          {rate != null && <div className="mono num" style={{ width: 32, fontSize: 9, color: rate >= 80 ? 'var(--col-done)' : (rate >= 50 ? 'var(--col-pending)' : 'var(--col-cancel)'), textAlign: 'right' }}>{rate.toFixed(0)}%</div>}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </Section>
          </div>

          {/* AP-127 Spotlight */}
          <Section title="◆ AP-127 SPOTLIGHT" hint="FOCUS COHORT — TODAY'S FLIGHTS" accent="var(--highlight)" fullWidth>
            {ap127.flights === 0 ? (
              <div className="mono uc" style={{ fontSize: 10, color: 'var(--ink-3)', padding: '20px 0', textAlign: 'center' }}>
                NO AP-127 FLIGHTS ON {String(day).padStart(2, '0')} {mo}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* AP-127 KPIs */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <DKPI label="FLIGHTS"    value={ap127.flights}        sub={`${ap127.lessons.size} LESSONS`} color="var(--highlight)" small={isMobile}/>
                  <DKPI label="STUDENTS"   value={ap127.students.size}  sub="FLYING"     color="var(--highlight)" small={isMobile}/>
                  <DKPI label="INSTR"      value={ap127.instructors.size} sub="ASSIGNED"  color="var(--highlight)" small={isMobile}/>
                  <DKPI label="COMPLETED"  value={ap127.completed}      sub={ap127.completionRate != null ? `${ap127.completionRate.toFixed(0)}% RATE` : '—'} color="var(--col-done)" small={isMobile}/>
                  <DKPI label="PENDING"    value={ap127.pending}        sub={`${ap127.standby} STBY`} color="var(--col-pending)" small={isMobile}/>
                  <DKPI label="CANCELED"   value={ap127.canceled}       sub="OF SCHED"   color="var(--col-cancel)" small={isMobile}/>
                  <DKPI label="HOURS"      value={hoursFmt(ap127.hours)} sub="PLANNED"   color="var(--highlight)" small={isMobile}/>
                  <DKPI label="VS SCHOOL"
                    value={apRate != null && schoolRate != null
                      ? `${(apRate - schoolRate >= 0 ? '+' : '')}${(apRate - schoolRate).toFixed(0)}%`
                      : '—'}
                    sub="COMPLETION DELTA"
                    color={apRate != null && schoolRate != null
                      ? (apRate >= schoolRate ? 'var(--col-done)' : 'var(--col-cancel)')
                      : 'var(--ink-3)'} small={isMobile}/>
                </div>

                {/* AP-127 vs School comparison bar */}
                {(apRate != null || schoolRate != null) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
                    <div className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)' }}>COMPLETION RATE COMPARISON (COMPLETED / COMPLETED+CANCELED)</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div className="mono uc" style={{ width: 70, fontSize: 10, color: 'var(--highlight)', fontWeight: 600 }}>AP-127</div>
                      <div style={{ flex: 1, height: 14, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
                        <div style={{ width: `${apRate || 0}%`, height: '100%', background: 'var(--highlight)', opacity: 0.85, transition: 'width .3s' }}/>
                      </div>
                      <div className="mono num" style={{ width: 50, fontSize: 11, color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>{apRate != null ? `${apRate.toFixed(0)}%` : '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div className="mono uc" style={{ width: 70, fontSize: 10, color: 'var(--ink-2)', fontWeight: 600 }}>SCHOOL</div>
                      <div style={{ flex: 1, height: 14, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
                        <div style={{ width: `${schoolRate || 0}%`, height: '100%', background: 'var(--col-pending)', opacity: 0.85, transition: 'width .3s' }}/>
                      </div>
                      <div className="mono num" style={{ width: 50, fontSize: 11, color: 'var(--ink)', textAlign: 'right', fontWeight: 600 }}>{schoolRate != null ? `${schoolRate.toFixed(0)}%` : '—'}</div>
                    </div>
                  </div>
                )}

                {/* AP-127 student list */}
                <div style={{ background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line-soft)', overflow: 'hidden' }}>
                  <div className="mono uc" style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '60px 1fr 70px 60px' : '60px 1.4fr 1.4fr 100px 70px 60px 90px',
                    gap: 8, padding: '6px 12px', fontSize: 9, color: 'var(--ink-3)',
                    borderBottom: '1px solid var(--line-soft)', background: 'var(--bg)',
                  }}>
                    <span>TIME</span>
                    <span>STUDENT</span>
                    {!isMobile && <span>INSTRUCTOR</span>}
                    <span>LESSON</span>
                    {!isMobile && <span>TAIL</span>}
                    <span>DUR</span>
                    <span>STATUS</span>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {ap127.list.map((f, i) => (
                      <div key={f.id + i}
                        onClick={() => app.setDrawer(f.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '60px 1fr 70px 60px' : '60px 1.4fr 1.4fr 100px 70px 60px 90px',
                          gap: 8, padding: '6px 12px', fontSize: 11, alignItems: 'center',
                          borderBottom: '1px solid var(--line-soft)', cursor: 'pointer',
                          background: i % 2 ? 'transparent' : 'color-mix(in oklch,var(--ink) 1.5%,transparent)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in oklch,var(--highlight) 8%,transparent)'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 ? 'transparent' : 'color-mix(in oklch,var(--ink) 1.5%,transparent)'}>
                        <span className="mono num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{f.start}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.student || '—'}</span>
                        {!isMobile && <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.instructor || '—'}</span>}
                        <span className="mono" style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.lesson}</span>
                        {!isMobile && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{f.tail || 'TBD'}</span>}
                        <span className="mono num" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{f.duration || ''}</span>
                        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <StatusPill status={f.status}/>
                          {f.isStandby && <StandbyTag/>}
                          {f.isSim && <Tag color="var(--col-sim)">SIM</Tag>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lessons being flown today */}
                {ap127.lessons.size > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="mono uc" style={{ fontSize: 9, color: 'var(--ink-3)' }}>LESSONS IN PROGRESS TODAY</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[...ap127.lessons].sort().map(l => (
                        <span key={l} className="mono uc" style={{
                          padding: '3px 8px', fontSize: 9, borderRadius: 3,
                          background: 'color-mix(in oklch,var(--highlight) 12%,var(--surface))',
                          border: '1px solid color-mix(in oklch,var(--highlight) 35%,transparent)',
                          color: 'var(--highlight)', fontWeight: 600,
                        }}>{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          <div style={{ height: 8 }}/>
        </div>
      </div>

      <Drawer/>
    </ArtboardShell>
  );
}

window.DailyBoard = DailyBoard;
