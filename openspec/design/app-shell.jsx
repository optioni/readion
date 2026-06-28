// app-shell.jsx — Canonical shared chrome + readiness components for Readion.
// Everything is namespaced under window.Shell to avoid colliding with the
// per-view `T` / `scoreColor` that the existing view files declare inline.
//
//   <script type="text/babel" src="app-shell.jsx"></script>
//   const { AppSidebar, ReadinessRing, DomainScoreRow } = window.Shell;
//
// Loaded as a babel script, so React must already be on the page.

(function () {
  // ── Tokens (internal — exported as Shell.T) ─────────────────────────────────
  const ST = {
    base:     'var(--readion-background-base)',
    surface:  'var(--readion-background-surface)',
    elevated: 'var(--readion-background-elevated)',
    overlay:  'var(--readion-background-overlay)',
    primary:  'var(--readion-primary)',
    accent:   'var(--readion-accent-label)',
    tPrimary: 'var(--readion-text-primary)',
    tSecond:  'var(--readion-text-secondary)',
    tMuted:   'var(--readion-text-muted)',
    tSubtle:  'var(--readion-text-subtle)',
    border:   'var(--readion-border-strong)',
    borderDef:'var(--readion-border-default)',
    poor:     'var(--readion-status-poor)',
    warn:     'var(--readion-status-warning)',
    medium:   'var(--readion-status-medium)',
    good:     'var(--readion-status-good)',
    rMd:      'var(--readion-rounded-md)',
    rLg:      'var(--readion-rounded-lg)',
    rXl:      'var(--readion-rounded-xl)',
    rFull:    'var(--readion-rounded-full)',
    sans:     'Inter, ui-sans-serif, system-ui',
  };

  // ── Readiness colour scale (single source of truth) ─────────────────────────
  // <50 poor · 50–64 warning · 65–74 medium · 75+ good
  function scoreColor(pct) {
    if (pct == null) return ST.tSubtle;
    if (pct < 50) return ST.poor;
    if (pct < 65) return ST.warn;
    if (pct < 75) return ST.medium;
    return ST.good;
  }
  function scoreBg(pct) {
    if (pct == null) return 'rgba(100,116,139,0.12)';
    if (pct < 50) return 'rgba(248,113,113,0.12)';
    if (pct < 65) return 'rgba(251,146,60,0.12)';
    if (pct < 75) return 'rgba(251,191,36,0.12)';
    return 'rgba(52,211,153,0.12)';
  }
  function scoreLabel(pct) {
    if (pct == null) return 'Not assessed';
    if (pct < 50) return 'Needs work';
    if (pct < 65) return 'Building';
    if (pct < 75) return 'On track';
    return 'Exam ready';
  }

  // ── Canvas shell (for spec/preview pages) ───────────────────────────────────
  const Canvas = (props) => <div className="canvas-wrap">{props.children}</div>;
  const CanvasSection = (props) => (
    <div className="canvas-section">
      <div className="canvas-section-head">
        <div className="canvas-section-title">{props.title}</div>
        {props.subtitle && <div className="canvas-section-sub">{props.subtitle}</div>}
      </div>
      <div className="canvas-row">{props.children}</div>
    </div>
  );
  const Artboard = (props) => (
    <div className="artboard-wrap" style={{ width: props.width }}>
      <div className="artboard-label">{props.label}</div>
      <div className="artboard-frame" style={{ width: props.width }}>{props.children}</div>
    </div>
  );

  // ── ReadinessRing — circular score, the hero readiness visual ───────────────
  function ReadinessRing(props) {
    const size = props.size || 132;
    const stroke = props.stroke || 9;
    const pct = props.pct;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const filled = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    const offset = circ * (1 - filled / 100);
    const col = scoreColor(pct);
    return (
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--readion-border-strong)" strokeWidth={stroke} />
          {pct != null && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={col} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
            />
          )}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: size * 0.27, fontWeight: 700, color: pct == null ? ST.tSubtle : ST.tPrimary, lineHeight: 1, fontFamily: ST.sans }}>
            {pct == null ? '—' : pct + '%'}
          </div>
          {props.caption !== false && (
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: col, marginTop: 5, fontFamily: ST.sans }}>
              {props.caption || scoreLabel(pct)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ReadinessBar — thin inline progress ─────────────────────────────────────
  function ReadinessBar(props) {
    const pct = props.pct;
    return (
      <div style={{ height: props.height || 3, background: 'var(--readion-border-strong)', borderRadius: 3, width: props.width || '100%', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: (pct == null ? 0 : pct) + '%', background: scoreColor(pct), borderRadius: 3 }} />
      </div>
    );
  }

  // ── DomainBadge — compact pill, dot + label + pct ───────────────────────────
  function DomainBadge(props) {
    const col = scoreColor(props.pct);
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: ST.rFull, background: scoreBg(props.pct), fontFamily: ST.sans }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: col, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: col, fontWeight: 500 }}>{props.label}</span>
        <span style={{ fontSize: 11, color: col, opacity: 0.75 }}>{props.pct}%</span>
      </div>
    );
  }

  // ── DomainScoreRow — labelled bar for breakdowns ────────────────────────────
  function DomainScoreRow(props) {
    const col = scoreColor(props.pct);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', fontFamily: ST.sans }}>
        <span style={{ fontSize: 13, color: props.focus ? ST.tPrimary : ST.tSecond, fontWeight: props.focus ? 500 : 400, width: props.labelWidth || 150, flexShrink: 0 }}>{props.label}</span>
        <div style={{ flex: 1, height: 5, background: ST.border, borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: props.pct + '%', background: col, borderRadius: 5 }} />
        </div>
        <span style={{ fontSize: 12, color: col, fontWeight: 600, width: 34, textAlign: 'right', flexShrink: 0 }}>{props.pct}%</span>
        {props.focus && (
          <span style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: ST.warn, background: scoreBg(40), padding: '2px 7px', borderRadius: ST.rFull, whiteSpace: 'nowrap' }}>Focus</span>
        )}
      </div>
    );
  }

  // ── AppSidebar — the canonical post-onboarding nav chrome ────────────────────
  const NAV = [
    { key: 'Dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
    { key: 'Sessions',  icon: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z' },
    { key: 'Progress',  icon: 'M18 20V10M12 20V4M6 20v-6' },
    { key: 'Ask AI',    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
    { key: 'Settings',  icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z' },
  ];

  function AppSidebar(props) {
    const active = props.active || 'Dashboard';
    const user = props.user || { name: 'Jamie D.', initials: 'JD' };
    return (
      <div style={{ width: 200, flexShrink: 0, background: ST.elevated, borderRight: '1px solid ' + ST.border, padding: '24px 16px', display: 'flex', flexDirection: 'column', minHeight: '100%', fontFamily: ST.sans }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, padding: '0 6px' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: ST.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z" fill="#0f172a" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: ST.tPrimary, letterSpacing: '0.01em' }}>Readion</span>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: ST.tMuted, marginBottom: 6, padding: '0 6px' }}>Study</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(function (item) {
            const isActive = item.key === active;
            return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: ST.rMd, background: isActive ? 'rgba(29,78,216,0.15)' : 'transparent', cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isActive ? ST.accent : ST.tMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                <span style={{ fontSize: 13, color: isActive ? ST.tPrimary : ST.tSecond, fontWeight: isActive ? 500 : 400 }}>{item.key}</span>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Admin entry — role-gated */}
        {props.admin && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ height: 1, background: ST.border, marginBottom: 8, opacity: 0.5 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: ST.rMd, cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ST.tSubtle} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span style={{ fontSize: 12, color: ST.tSubtle }}>Admin panel</span>
            </div>
          </div>
        )}

        {/* User card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: ST.rMd, border: '1px solid ' + ST.border }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: ST.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: ST.accent }}>{user.initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: ST.tPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── PageHeader — eyebrow + title row used across views ──────────────────────
  function PageHeader(props) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: props.mb != null ? props.mb : 28, fontFamily: ST.sans }}>
        <div>
          {props.eyebrow && <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: ST.tMuted, marginBottom: 4 }}>{props.eyebrow}</div>}
          <div style={{ fontSize: 22, fontWeight: 600, color: ST.tPrimary, lineHeight: 1.25 }}>{props.title}</div>
        </div>
        {props.right}
      </div>
    );
  }

  // ── AppFrame — sidebar + scrollable content, the standard view skeleton ─────
  function AppFrame(props) {
    return (
      <div style={{ display: 'flex', fontFamily: ST.sans, background: ST.base, minHeight: props.minHeight || 700 }}>
        <AppSidebar active={props.active} admin={props.admin} user={props.user} />
        <div style={{ flex: 1, padding: props.pad || '32px 40px', minWidth: 0 }}>{props.children}</div>
      </div>
    );
  }

  // ── AdminSidebar — the admin-console nav chrome ─────────────────────────────
  const ADMIN_NAV = [
    { key: 'Certifications',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { key: 'Review queue',    icon: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z', badge: 4 },
    { key: 'Sources',         icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
    { key: 'Users',           icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
    { key: 'Audit Log',       icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z' },
    { key: 'Settings',        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  function AdminSidebar(props) {
    const active = props.active || 'Certifications';
    const email = (props.user && props.user.email) || 'admin@org.io';
    return (
      <div style={{ width: 200, flexShrink: 0, background: ST.elevated, borderRight: '1px solid ' + ST.border, padding: '24px 16px', display: 'flex', flexDirection: 'column', minHeight: '100%', fontFamily: ST.sans }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, padding: '0 6px' }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: ST.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z" fill="#0f172a" /></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: ST.tPrimary }}>Readion</span>
        </div>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: ST.warn, marginBottom: 20, padding: '0 6px' }}>Admin</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {ADMIN_NAV.map(function (item) {
            const isActive = item.key === active;
            return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: ST.rMd, background: isActive ? 'rgba(29,78,216,0.15)' : 'transparent', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isActive ? ST.accent : ST.tMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                <span style={{ fontSize: 13, color: isActive ? ST.tPrimary : ST.tSecond, fontWeight: isActive ? 500 : 400 }}>{item.key}</span>
                {item.badge != null && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: ST.rFull, background: 'rgba(124,140,248,0.15)', border: '1px solid rgba(124,140,248,0.3)', color: ST.accent }}>{item.badge}</span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '8px', borderRadius: ST.rMd, border: '1px solid ' + ST.border }}>
          <div style={{ fontSize: 10, color: ST.warn, marginBottom: 2 }}>Admin session</div>
          <div style={{ fontSize: 12, color: ST.tPrimary, fontWeight: 500 }}>{email}</div>
        </div>
      </div>
    );
  }

  window.Shell = {
    T: ST,
    scoreColor, scoreBg, scoreLabel,
    Canvas, CanvasSection, Artboard,
    ReadinessRing, ReadinessBar, DomainBadge, DomainScoreRow,
    AppSidebar, AdminSidebar, AppFrame, PageHeader,
  };
})();
