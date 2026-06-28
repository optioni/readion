// onboarding-steps.jsx — All step components for 3 Readion onboarding variants
// V1: Minimal · V2: Warm/Guided · V3: Structured (sidebar) · Edge cases

// ── Data ──────────────────────────────────────────────────────────────────────

const CERTS = [
  { code: 'SAA-C03', name: 'Solutions Architect – Associate',    vendor: 'Amazon Web Services' },
  { code: 'SAP-C02', name: 'Solutions Architect – Professional', vendor: 'Amazon Web Services' },
  { code: 'DVA-C02', name: 'Developer – Associate',              vendor: 'Amazon Web Services' },
  { code: 'PCA',     name: 'Professional Cloud Architect',       vendor: 'Google Cloud' },
  { code: 'AZ-104', name: 'Azure Administrator Associate',       vendor: 'Microsoft Azure' },
  { code: 'CKA',    name: 'Certified Kubernetes Administrator',  vendor: 'Linux Foundation' },
  { code: 'SY0-701', name: 'CompTIA Security+',                 vendor: 'CompTIA' },
];

// ── Shared primitives ─────────────────────────────────────────────────────────

const OBBase = ({ children }) => (
  <div style={{
    background: 'var(--readion-background-base)',
    fontFamily: 'var(--readion-font-sans)',
    padding: 40,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100%',
    boxSizing: 'border-box',
  }}>
    {children}
  </div>
);

const OBCard = ({ children, width = 420, padding = 32 }) => (
  <div style={{
    width,
    flexShrink: 0,
    background: 'var(--readion-background-surface)',
    borderRadius: 'var(--readion-rounded-xl)',
    padding,
    boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
  }}>
    {children}
  </div>
);

const OBBar = ({ step, total = 3 }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ height: 2, background: 'var(--readion-border-strong)', borderRadius: 2 }}>
      <div style={{ height: '100%', width: `${(step / total) * 100}%`, background: 'var(--readion-primary)', borderRadius: 2 }} />
    </div>
  </div>
);

const OBStepLabel = ({ step }) => (
  <div style={{
    fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--readion-accent-label)', marginBottom: 6,
  }}>Step {step} of 3</div>
);

const OBTitle = ({ title, sub }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--readion-text-primary)', lineHeight: 1.3, marginBottom: sub ? 5 : 0 }}>{title}</div>
    {sub && <div style={{ fontSize: 13, color: 'var(--readion-text-muted)', lineHeight: 1.5 }}>{sub}</div>}
  </div>
);

const OBNav = ({ step }) => (
  <div style={{
    display: 'flex', justifyContent: step > 1 ? 'space-between' : 'flex-end', alignItems: 'center',
    marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--readion-border-strong)',
  }}>
    {step > 1 && <span style={{ fontSize: 13, color: 'var(--readion-text-muted)', cursor: 'pointer' }}>← Back</span>}
    <button style={{
      padding: '9px 22px', background: 'var(--readion-primary)', color: '#fff',
      border: 'none', borderRadius: 'var(--readion-rounded-md)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
    }}>Continue →</button>
  </div>
);

const OBPills = ({ options, selected }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {options.map(o => (
      <div key={o} style={{
        padding: '5px 12px', borderRadius: 'var(--readion-rounded-full)', fontSize: 13,
        fontWeight: o === selected ? 500 : 400,
        background: o === selected ? 'var(--readion-primary)' : 'transparent',
        color: o === selected ? '#fff' : 'var(--readion-text-secondary)',
        border: `1px solid ${o === selected ? 'var(--readion-primary)' : 'var(--readion-border-strong)'}`,
        cursor: 'pointer',
      }}>{o}</div>
    ))}
  </div>
);

const OBPref = ({ label, options, selected, note }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--readion-text-muted)', marginBottom: 8 }}>{label}</div>
    <OBPills options={options} selected={selected} />
    {note && <div style={{ fontSize: 11, color: 'var(--readion-text-subtle)', marginTop: 5 }}>{note}</div>}
  </div>
);

const SearchInput = ({ placeholder = 'Search certifications…', suffix }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--readion-background-base)',
    border: '1px solid var(--readion-border-strong)',
    borderRadius: 'var(--readion-rounded-md)',
    padding: '7px 12px', marginBottom: 10,
  }}>
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M11 11l3 3" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <span style={{ fontSize: 13, color: 'var(--readion-text-subtle)', flex: 1 }}>{placeholder}</span>
    {suffix && <span style={{ fontSize: 11, color: 'var(--readion-text-subtle)', background: 'var(--readion-background-elevated)', padding: '2px 6px', borderRadius: 3 }}>{suffix}</span>}
  </div>
);

// ── V1: Minimal ───────────────────────────────────────────────────────────────

const V1Step1 = () => (
  <OBBase>
    <OBCard>
      <OBBar step={1} />
      <OBStepLabel step={1} />
      <OBTitle title="Which certification are you preparing for?" />
      <SearchInput />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {CERTS.map((c, i) => (
          <div key={c.code} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
            borderRadius: 'var(--readion-rounded-md)',
            background: i === 0 ? 'rgba(29,78,216,0.12)' : 'transparent',
            border: `1px solid ${i === 0 ? 'var(--readion-primary)' : 'transparent'}`,
            cursor: 'pointer',
          }}>
            <div style={{
              width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${i === 0 ? 'var(--readion-primary)' : 'var(--readion-border-strong)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i === 0 && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--readion-primary)' }} />}
            </div>
            <div>
              <div style={{ fontSize: 13, color: i === 0 ? 'var(--readion-text-primary)' : 'var(--readion-text-secondary)', fontWeight: i === 0 ? 500 : 400 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--readion-text-muted)', marginTop: 1 }}>{c.vendor} · {c.code}</div>
            </div>
          </div>
        ))}
      </div>
      <OBNav step={1} />
    </OBCard>
  </OBBase>
);

const V1Step2 = () => (
  <OBBase>
    <OBCard>
      <OBBar step={2} />
      <OBStepLabel step={2} />
      <OBTitle title="Set your study defaults" sub="These become your starting point — adjust any time in settings." />
      <OBPref label="Session length" options={['10 min', '20 min', '30 min', '45 min']} selected="20 min" />
      <OBPref label="Content mix" options={['Questions', 'Mixed', 'Concepts first']} selected="Mixed" />
      <OBPref label="Difficulty" options={['Adaptive', 'Easy', 'Medium', 'Hard']} selected="Adaptive" note="Adaptive adjusts automatically as you improve" />
      <OBPref label="Learning style" options={['Spaced rep.', 'Intensive']} selected="Spaced rep." />
      <OBNav step={2} />
    </OBCard>
  </OBBase>
);

const V1Step3 = () => (
  <OBBase>
    <OBCard>
      <OBBar step={3} />
      <OBStepLabel step={3} />
      <OBTitle title="Build your personal study plan" />
      <p style={{ fontSize: 14, color: 'var(--readion-text-secondary)', lineHeight: 1.65, margin: '0 0 28px' }}>
        A 15-minute diagnostic measures where you stand today. Readion uses the results to weight your sessions toward your actual knowledge gaps — so every minute counts from day one.
      </p>
      <button style={{
        width: '100%', padding: 11, background: 'var(--readion-primary)', color: '#fff',
        border: 'none', borderRadius: 'var(--readion-rounded-md)', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', marginBottom: 14,
      }}>
        Start diagnostic <span style={{ opacity: 0.6, fontWeight: 400 }}>· ~15 min</span>
      </button>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--readion-text-muted)', cursor: 'pointer' }}>Skip — go to dashboard →</span>
      </div>
    </OBCard>
  </OBBase>
);

// ── V2: Warm / Guided ─────────────────────────────────────────────────────────

const V2ProgressBar = ({ step }) => {
  const labels = ['Certification', 'Preferences', 'Diagnostic'];
  const pct = step === 1 ? 16 : step === 2 ? 50 : 100;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {labels.map((s, i) => (
          <span key={s} style={{
            fontSize: 11, letterSpacing: '0.04em',
            color: i + 1 === step ? 'var(--readion-accent-label)' : i + 1 < step ? 'var(--readion-primary)' : 'var(--readion-text-subtle)',
          }}>{i + 1 < step ? '✓ ' : ''}{s}</span>
        ))}
      </div>
      <div style={{ height: 3, background: 'var(--readion-border-strong)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--readion-primary)', borderRadius: 3 }} />
      </div>
    </div>
  );
};

const CheckCircle = () => (
  <div style={{
    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(52,211,153,0.12)', border: '1px solid var(--readion-status-good)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  }}>
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
      <path d="M2 4.5l2 2 3-3" stroke="var(--readion-status-good)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

const V2Step1 = () => (
  <OBBase>
    <OBCard width={540} padding={36}>
      <V2ProgressBar step={1} />
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--readion-accent-label)', marginBottom: 6 }}>Welcome to Readion</div>
      <OBTitle title="What are you studying for?" sub="Select the certification exam you're working toward." />
      {CERTS.map((c, i) => (
        <div key={c.code} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
          borderRadius: 'var(--readion-rounded-lg)',
          background: i === 0 ? 'rgba(29,78,216,0.1)' : 'var(--readion-background-base)',
          border: `1px solid ${i === 0 ? 'var(--readion-primary)' : 'var(--readion-border-strong)'}`,
          cursor: 'pointer', marginBottom: 6,
        }}>
          <div style={{
            flexShrink: 0, width: 36, height: 36,
            background: 'var(--readion-background-surface)',
            borderRadius: 'var(--readion-rounded-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: i === 0 ? 'var(--readion-accent-label)' : 'var(--readion-text-muted)', letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.2 }}>{c.code}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: i === 0 ? 'var(--readion-text-primary)' : 'var(--readion-text-secondary)', fontWeight: i === 0 ? 500 : 400 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: 'var(--readion-text-muted)', marginTop: 2 }}>{c.vendor}</div>
          </div>
          {i === 0 && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="var(--readion-primary)"/>
              <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      ))}
      <OBNav step={1} />
    </OBCard>
  </OBBase>
);

const V2PrefCard = ({ icon, label, options, selected }) => (
  <div style={{
    background: 'var(--readion-background-base)',
    border: '1px solid var(--readion-border-strong)',
    borderRadius: 'var(--readion-rounded-lg)',
    padding: '12px 14px', marginBottom: 8,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--readion-text-muted)' }}>{label}</span>
    </div>
    <OBPills options={options} selected={selected} />
  </div>
);

const V2Step2 = () => (
  <OBBase>
    <OBCard width={540} padding={36}>
      <V2ProgressBar step={2} />
      <OBTitle title="How do you want to study?" sub="Readion adapts over time — these are your starting defaults." />
      <V2PrefCard icon="⏱" label="Session length"  options={['10 min', '20 min', '30 min', '45 min']} selected="20 min" />
      <V2PrefCard icon="🎯" label="Content mix"     options={['Questions', 'Mixed', 'Concepts first']}  selected="Mixed" />
      <V2PrefCard icon="📊" label="Difficulty"      options={['Adaptive', 'Easy', 'Medium', 'Hard']}    selected="Adaptive" />
      <V2PrefCard icon="🔁" label="Learning style"  options={['Spaced rep.', 'Intensive']}              selected="Spaced rep." />
      <OBNav step={2} />
    </OBCard>
  </OBBase>
);

const V2Step3 = () => (
  <OBBase>
    <OBCard width={540} padding={36}>
      <V2ProgressBar step={3} />
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--readion-status-good)', marginBottom: 8 }}>Almost ready</div>
      <OBTitle title="Start with a baseline snapshot" sub="Know exactly where you stand before you spend a single minute studying." />
      <div style={{ marginBottom: 26 }}>
        {[
          ['Surfaces your weakest topics immediately',    "Readion weights your first sessions toward them — no wasted time."],
          ['Calibrates question difficulty to your level',"You won't drill easy material you already know."],
          ['Creates a measurable progress baseline',      "You'll see exactly how far you've come as exam day approaches."],
        ].map(([h, d]) => (
          <div key={h} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <CheckCircle />
            <div>
              <div style={{ fontSize: 13, color: 'var(--readion-text-primary)', fontWeight: 500, marginBottom: 2 }}>{h}</div>
              <div style={{ fontSize: 12, color: 'var(--readion-text-muted)', lineHeight: 1.5 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
      <button style={{
        width: '100%', padding: 11, background: 'var(--readion-primary)', color: '#fff',
        border: 'none', borderRadius: 'var(--readion-rounded-md)', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', marginBottom: 12,
      }}>
        Take the diagnostic <span style={{ opacity: 0.65, fontWeight: 400 }}>· ~15 min</span>
      </button>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--readion-text-muted)', cursor: 'pointer' }}>Skip — I'll set my own pace</span>
      </div>
    </OBCard>
  </OBBase>
);

// ── V3: Structured (sidebar) ──────────────────────────────────────────────────

const V3Sidebar = ({ active }) => {
  const steps = ['Certification', 'Preferences', 'Diagnostic'];
  return (
    <div style={{
      width: 200, flexShrink: 0,
      background: 'var(--readion-background-elevated)',
      borderRight: '1px solid var(--readion-border-strong)',
      padding: '32px 20px',
      display: 'flex', flexDirection: 'column',
      alignSelf: 'stretch',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--readion-accent-label)', marginBottom: 32 }}>Readion</div>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--readion-text-subtle)', marginBottom: 10 }}>Setup</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((s, i) => {
          const state = i + 1 < active ? 'done' : i + 1 === active ? 'active' : 'upcoming';
          return (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 'var(--readion-rounded-md)',
              background: state === 'active' ? 'rgba(29,78,216,0.15)' : 'transparent',
              cursor: state === 'done' ? 'pointer' : 'default',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: state === 'done' ? 'rgba(29,78,216,0.25)' : state === 'active' ? 'var(--readion-primary)' : 'transparent',
                border: `1px solid ${state === 'upcoming' ? 'var(--readion-border-strong)' : 'transparent'}`,
              }}>
                {state === 'done'
                  ? <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5l2 2 3-3" stroke="var(--readion-accent-label)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <span style={{ fontSize: 10, color: state === 'active' ? '#fff' : 'var(--readion-text-subtle)', fontWeight: 500 }}>{i + 1}</span>
                }
              </div>
              <span style={{ fontSize: 13, color: state === 'active' ? 'var(--readion-text-primary)' : state === 'done' ? 'var(--readion-text-secondary)' : 'var(--readion-text-muted)' }}>{s}</span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, color: 'var(--readion-text-subtle)', lineHeight: 1.6 }}>Setup takes about 2 minutes.</div>
    </div>
  );
};

const V3Layout = ({ step, children }) => (
  <div style={{ display: 'flex', fontFamily: 'var(--readion-font-sans)', background: 'var(--readion-background-base)', minHeight: '100%' }}>
    <V3Sidebar active={step} />
    <div style={{ flex: 1, padding: '40px 48px', minWidth: 0 }}>{children}</div>
  </div>
);

const V3NavRow = ({ step }) => (
  <div style={{ display: 'flex', justifyContent: step > 1 ? 'space-between' : 'flex-end', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--readion-border-strong)' }}>
    {step > 1 && <span style={{ fontSize: 13, color: 'var(--readion-text-muted)', cursor: 'pointer' }}>← Back</span>}
    <button style={{ padding: '9px 22px', background: 'var(--readion-primary)', color: '#fff', border: 'none', borderRadius: 'var(--readion-rounded-md)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Continue →</button>
  </div>
);

const CERT_GROUPS = [
  { vendor: 'Amazon Web Services',    certs: CERTS.filter(c => c.vendor === 'Amazon Web Services') },
  { vendor: 'Google Cloud',           certs: CERTS.filter(c => c.vendor === 'Google Cloud') },
  { vendor: 'Microsoft Azure',        certs: CERTS.filter(c => c.vendor === 'Microsoft Azure') },
  { vendor: 'Linux Foundation · CompTIA', certs: CERTS.filter(c => ['Linux Foundation','CompTIA'].includes(c.vendor)) },
];

const V3Step1 = () => (
  <V3Layout step={1}>
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--readion-accent-label)', marginBottom: 6 }}>Step 1 of 3</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--readion-text-primary)', lineHeight: 1.25, marginBottom: 4 }}>Choose your target certification</div>
      <div style={{ fontSize: 13, color: 'var(--readion-text-muted)', marginBottom: 20 }}>You can add more certifications later from your profile.</div>
      <SearchInput suffix="7 available" />
      {CERT_GROUPS.map(({ vendor, certs }) => (
        <div key={vendor} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--readion-text-subtle)', padding: '5px 10px' }}>{vendor}</div>
          {certs.map(c => (
            <div key={c.code} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 'var(--readion-rounded-md)',
              background: c.code === 'SAA-C03' ? 'rgba(29,78,216,0.12)' : 'transparent',
              border: `1px solid ${c.code === 'SAA-C03' ? 'var(--readion-primary)' : 'transparent'}`,
              cursor: 'pointer', marginBottom: 2,
            }}>
              <div style={{
                width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${c.code === 'SAA-C03' ? 'var(--readion-primary)' : 'var(--readion-border-strong)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {c.code === 'SAA-C03' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--readion-primary)' }} />}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: c.code === 'SAA-C03' ? 'var(--readion-text-primary)' : 'var(--readion-text-secondary)', fontWeight: c.code === 'SAA-C03' ? 500 : 400 }}>{c.name}</span>
              <span style={{ fontSize: 10, color: 'var(--readion-text-muted)', background: 'var(--readion-background-elevated)', padding: '2px 6px', borderRadius: 3, fontFamily: 'var(--readion-font-mono)' }}>{c.code}</span>
            </div>
          ))}
        </div>
      ))}
      <V3NavRow step={1} />
    </div>
  </V3Layout>
);

const V3Step2 = () => (
  <V3Layout step={2}>
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--readion-accent-label)', marginBottom: 6 }}>Step 2 of 3</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--readion-text-primary)', marginBottom: 4 }}>Study preferences</div>
      <div style={{ fontSize: 13, color: 'var(--readion-text-muted)', marginBottom: 24 }}>Readion adapts over time — these are your starting defaults.</div>

      {/* Session length slider */}
      <div style={{ background: 'var(--readion-background-surface)', border: '1px solid var(--readion-border-strong)', borderRadius: 'var(--readion-rounded-lg)', padding: '20px 20px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--readion-text-muted)' }}>Session length</span>
          <span style={{ fontSize: 13, color: 'var(--readion-accent-label)', fontWeight: 500 }}>20 min</span>
        </div>
        <div style={{ position: 'relative', height: 18, marginBottom: 6 }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, background: 'var(--readion-border-strong)', borderRadius: 2, transform: 'translateY(-50%)' }}>
            <div style={{ height: '100%', width: '36%', background: 'var(--readion-primary)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: '50%', left: '36%', width: 13, height: 13, background: '#fff', border: '2px solid var(--readion-primary)', borderRadius: '50%', transform: 'translate(-50%,-50%)', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['5m', '15m', '30m', '45m', '60m'].map(m => (
            <span key={m} style={{ fontSize: 10, color: 'var(--readion-text-subtle)' }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Other prefs as segmented rows */}
      <div style={{ background: 'var(--readion-background-surface)', border: '1px solid var(--readion-border-strong)', borderRadius: 'var(--readion-rounded-lg)', padding: '16px 20px' }}>
        {[
          { label: 'Content mix',    options: ['Questions', 'Mixed', 'Concepts first'], selected: 'Mixed' },
          { label: 'Difficulty',     options: ['Adaptive', 'Easy', 'Medium', 'Hard'],   selected: 'Adaptive' },
          { label: 'Learning style', options: ['Spaced rep.', 'Intensive'],              selected: 'Spaced rep.' },
        ].map(({ label, options, selected }, idx, arr) => (
          <div key={label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14 }}>
              <span style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--readion-text-muted)', width: 100, flexShrink: 0 }}>{label}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {options.map(o => (
                  <div key={o} style={{
                    padding: '5px 10px', borderRadius: 'var(--readion-rounded-md)', fontSize: 12,
                    background: o === selected ? 'var(--readion-primary)' : 'var(--readion-background-elevated)',
                    color: o === selected ? '#fff' : 'var(--readion-text-secondary)',
                    border: `1px solid ${o === selected ? 'var(--readion-primary)' : 'var(--readion-border-strong)'}`,
                    cursor: 'pointer',
                  }}>{o}</div>
                ))}
              </div>
            </div>
            {idx < arr.length - 1 && <div style={{ height: 1, background: 'var(--readion-border-strong)', marginBottom: 14 }} />}
          </div>
        ))}
      </div>

      {/* Estimate callout */}
      <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--readion-background-elevated)', border: '1px solid var(--readion-border-strong)', borderRadius: 'var(--readion-rounded-md)' }}>
        <span style={{ fontSize: 12, color: 'var(--readion-text-muted)' }}>At 20 min/session × 5 days/week → </span>
        <span style={{ fontSize: 12, color: 'var(--readion-accent-label)' }}>~8 weeks to exam-ready</span>
        <span style={{ fontSize: 12, color: 'var(--readion-text-subtle)' }}> (estimate)</span>
      </div>

      <V3NavRow step={2} />
    </div>
  </V3Layout>
);

const V3Step3 = () => (
  <V3Layout step={3}>
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--readion-accent-label)', marginBottom: 6 }}>Step 3 of 3</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--readion-text-primary)', marginBottom: 4 }}>Diagnostic assessment</div>
      <div style={{ fontSize: 13, color: 'var(--readion-text-muted)', marginBottom: 24 }}>Optional — but it makes your first week significantly more effective.</div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--readion-text-subtle)', marginBottom: 10 }}>What it does</div>
          {[
            'Maps your knowledge against all exam domains',
            'Front-loads your weakest areas in session 1',
            'Calibrates difficulty so you\'re never bored or overwhelmed',
          ].map(item => (
            <div key={item} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--readion-accent-label)', flexShrink: 0, marginTop: 7 }} />
              <span style={{ fontSize: 13, color: 'var(--readion-text-secondary)', lineHeight: 1.55 }}>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ width: 148, flexShrink: 0 }}>
          <div style={{ background: 'var(--readion-background-surface)', border: '1px solid var(--readion-border-strong)', borderRadius: 'var(--readion-rounded-lg)', padding: '16px 12px', textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--readion-text-primary)', lineHeight: 1 }}>~15</div>
            <div style={{ fontSize: 11, color: 'var(--readion-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>minutes</div>
            <div style={{ height: 1, background: 'var(--readion-border-strong)', marginBottom: 10 }} />
            <div style={{ fontSize: 12, color: 'var(--readion-text-muted)' }}>30 adaptive questions</div>
          </div>
          <button style={{ width: '100%', padding: '9px 0', background: 'var(--readion-primary)', color: '#fff', border: 'none', borderRadius: 'var(--readion-rounded-md)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Start →
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--readion-border-strong)' }}>
        <span style={{ fontSize: 13, color: 'var(--readion-text-muted)', cursor: 'pointer' }}>← Back</span>
        <span style={{ fontSize: 13, color: 'var(--readion-text-subtle)', cursor: 'pointer' }}>Skip — go to dashboard</span>
      </div>
    </div>
  </V3Layout>
);

// ── Edge cases ────────────────────────────────────────────────────────────────

const CertBadgeIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect width="44" height="44" rx="10" fill="rgba(29,78,216,0.1)"/>
    <path d="M22 7l3.5 7.5 8 1.2-5.75 5.6 1.4 8L22 26l-7.15 3.3 1.4-8L10.5 15.7l8-1.2L22 7z" stroke="var(--readion-accent-label)" strokeWidth="1.4" strokeLinejoin="round"/>
    <line x1="17" y1="36" x2="22" y2="38" stroke="var(--readion-text-muted)" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="22" y1="38" x2="27" y2="36" stroke="var(--readion-text-muted)" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="22" y1="38" x2="22" y2="42" stroke="var(--readion-text-muted)" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const EmptyStateUser = () => (
  <OBBase>
    <OBCard>
      <div style={{ textAlign: 'center', padding: '20px 0 4px' }}>
        <div style={{ display: 'inline-flex', marginBottom: 18 }}><CertBadgeIcon /></div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--readion-text-primary)', marginBottom: 10 }}>No certifications available yet</div>
        <div style={{ fontSize: 13, color: 'var(--readion-text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
          Readion is ready — but your organization hasn't set up any certification programs yet.
        </div>
        <div style={{ fontSize: 13, color: 'var(--readion-text-muted)', lineHeight: 1.65, marginBottom: 24, textAlign: 'left', background: 'var(--readion-background-base)', borderRadius: 'var(--readion-rounded-lg)', padding: '12px 14px' }}>
          Certifications are added by your account admin. They define the exam structure, question bank, and syllabus everyone in your org studies from. Once at least one is configured, you can continue setup here.
        </div>
        <button style={{ padding: '9px 20px', background: 'transparent', color: 'var(--readion-text-secondary)', border: '1px solid var(--readion-border-strong)', borderRadius: 'var(--readion-rounded-md)', fontSize: 13, cursor: 'pointer', marginBottom: 14, width: '100%' }}>
          Notify me when certs are added
        </button>
        <div style={{ fontSize: 12, color: 'var(--readion-text-subtle)' }}>
          Questions? Reach your admin or{' '}
          <span style={{ color: 'var(--readion-accent-label)', cursor: 'pointer' }}>support@readion.app</span>
        </div>
      </div>
    </OBCard>
  </OBBase>
);

const EmptyStateAdmin = () => (
  <OBBase>
    <OBCard>
      <div style={{ textAlign: 'center', padding: '20px 0 4px' }}>
        <div style={{ display: 'inline-flex', marginBottom: 18 }}><CertBadgeIcon /></div>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--readion-status-warning)', marginBottom: 8 }}>Admin setup required</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--readion-text-primary)', marginBottom: 10 }}>Set up your first certification</div>
        <div style={{ fontSize: 13, color: 'var(--readion-text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
          You're the first admin on this Readion account. Before anyone can start studying, you'll need to add at least one certification.
        </div>
        <div style={{ fontSize: 13, color: 'var(--readion-text-muted)', lineHeight: 1.65, marginBottom: 24, textAlign: 'left', background: 'var(--readion-background-base)', borderRadius: 'var(--readion-rounded-lg)', padding: '12px 14px' }}>
          Certifications define the exam structure, domains, and question banks. Your users will select from whatever you configure here. You can add more certifications, invite other admins, and import question banks after setup.
        </div>
        <button style={{ padding: '11px 22px', background: 'var(--readion-primary)', color: '#fff', border: 'none', borderRadius: 'var(--readion-rounded-md)', fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%', marginBottom: 10 }}>
          Set up first certification →
        </button>
        <div style={{ fontSize: 12, color: 'var(--readion-text-subtle)' }}>You can invite other admins and add question banks afterwards.</div>
      </div>
    </OBCard>
  </OBBase>
);

// ── Export all ────────────────────────────────────────────────────────────────

Object.assign(window, {
  V1Step1, V1Step2, V1Step3,
  V2Step1, V2Step2, V2Step3,
  V3Step1, V3Step2, V3Step3,
  EmptyStateUser, EmptyStateAdmin,
});
