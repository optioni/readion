// auth-components.jsx — shared auth (login flow) sub-components + screens.
// Extracted verbatim from the original Login.html so the split route files
// (SignIn / Register / ForgotPassword / ResetPassword / VerifyEmail) all render
// from one source of truth. Exported on window.Auth.
//
//   <script type="text/babel" src="auth-components.jsx"></script>
//   const { AuthLayout, SignInScreen } = window.Auth;
//
// Loaded as a babel script, so React must already be on the page.

(function () {
  const T = {
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
    good:     'var(--readion-status-good)',
    rMd:      'var(--readion-rounded-md)',
    rLg:      'var(--readion-rounded-lg)',
    rXl:      'var(--readion-rounded-xl)',
    rFull:    'var(--readion-rounded-full)',
  };

  // ── Brand panel (left) ──────────────────────────────────────────────────────
  const BrandPanel = () => (
    <div style={{ width: 280, flexShrink: 0, background: T.elevated, borderRight: '1px solid ' + T.border, padding: '40px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 48 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z" fill="#0f172a"/></svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.tPrimary, letterSpacing: '-0.01em' }}>Readion</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.tPrimary, lineHeight: 1.3, marginBottom: 10 }}>
            Exam-ready,<br />faster.
          </div>
          <div style={{ fontSize: 13, color: T.tMuted, lineHeight: 1.65 }}>
            Adaptive study sessions, spaced-repetition review, and AI explanations — all grounded in your actual weak areas.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            'Readiness score that actually predicts pass/fail',
            'AI agent during sessions — no context limits',
            'Diagnostic that maps your gaps from day one',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '1px solid var(--readion-status-good)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <svg width="8" height="8" viewBox="0 0 9 9" fill="none"><path d="M2 4.5l2 2 3-3" stroke="var(--readion-status-good)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 12, color: T.tSecond, lineHeight: 1.55 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 14px', background: T.overlay, border: '1px solid ' + T.border, borderRadius: T.rLg }}>
        <div style={{ fontSize: 12, color: T.tSecond, lineHeight: 1.6, marginBottom: 8, fontStyle: 'italic' }}>
          "Passed SAA-C03 on the first attempt. The weak area targeting is genuinely different."
        </div>
        <div style={{ fontSize: 11, color: T.tMuted }}>— Alex K., AWS Solutions Architect</div>
      </div>
    </div>
  );

  // ── Form field ──────────────────────────────────────────────────────────────
  const Field = ({ label, type, placeholder, value, error, note, suffix }) => (
    <div style={{ marginBottom: error ? 10 : 18 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.tSecond, marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          readOnly
          type={type || 'text'}
          defaultValue={value || ''}
          placeholder={placeholder}
          style={{
            width: '100%', padding: suffix ? '8px 40px 8px 12px' : '8px 12px',
            background: T.base, border: '1px solid ' + (error ? T.poor : T.border),
            borderRadius: T.rMd, fontSize: 14, color: T.tPrimary,
            fontFamily: 'inherit', outline: 'none',
            boxShadow: error ? '0 0 0 3px rgba(248,113,113,0.12)' : 'none',
          }}
        />
        {suffix && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }}>
            {suffix}
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: 11, color: T.poor, marginTop: 5 }}>{error}</div>}
      {note && !error && <div style={{ fontSize: 11, color: T.tSubtle, marginTop: 5 }}>{note}</div>}
    </div>
  );

  const EyeIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--readion-text-subtle)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );

  // ── Password strength ─────────────────────────────────────────────────────────
  const PasswordStrength = ({ strength }) => {
    const levels = ['Weak', 'Fair', 'Good', 'Strong'];
    const colors = [T.poor, T.poor, 'var(--readion-status-warning)', T.good];
    const color = colors[strength - 1] || T.border;
    return (
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.tSecond, marginBottom: 6 }}>Password</label>
        <div style={{ position: 'relative' }}>
          <input readOnly type="password" defaultValue="••••••••••" style={{ width: '100%', padding: '8px 40px 8px 12px', background: T.base, border: '1px solid ' + T.border, borderRadius: T.rMd, fontSize: 14, color: T.tPrimary, fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }}><EyeIcon /></div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? color : T.border }} />
          ))}
          <span style={{ fontSize: 11, color, marginLeft: 4, whiteSpace: 'nowrap' }}>{levels[strength - 1]}</span>
        </div>
      </div>
    );
  };

  const SubmitBtn = ({ label, loading }) => (
    <button style={{ width: '100%', padding: '10px 0', background: T.primary, color: '#fff', border: 'none', borderRadius: T.rMd, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {loading && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />}
      {label}
    </button>
  );

  const OrDivider = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      <span style={{ fontSize: 11, color: T.tSubtle }}>or</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );

  const SsoButton = ({ label }) => (
    <button style={{ width: '100%', padding: '9px 0', background: 'transparent', color: T.tSecond, border: '1px solid ' + T.border, borderRadius: T.rMd, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="var(--readion-text-muted)" strokeWidth="1.5"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="var(--readion-text-muted)" strokeWidth="1.5"/>
      </svg>
      {label}
    </button>
  );

  const FormPanel = ({ children }) => (
    <div style={{ flex: 1, background: T.surface, padding: '40px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {children}
    </div>
  );

  const AuthLayout = ({ children }) => (
    <div style={{ display: 'flex', fontFamily: 'Inter, ui-sans-serif, system-ui', background: T.base, height: '100%' }}>
      <BrandPanel />
      <FormPanel>{children}</FormPanel>
    </div>
  );

  // ── Screen: Sign in ───────────────────────────────────────────────────────────
  const SignInScreen = () => (
    <AuthLayout>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 4 }}>Sign in</div>
      <div style={{ fontSize: 13, color: T.tMuted, marginBottom: 28 }}>
        Don't have an account?{' '}
        <span style={{ color: T.accent, cursor: 'pointer' }}>Create one</span>
      </div>

      <Field label="Email" type="email" placeholder="you@example.com" value="jamie@org.io" />
      <Field label="Password" type="password" placeholder="" value="••••••••" suffix={<EyeIcon />} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -10, marginBottom: 22 }}>
        <span style={{ fontSize: 12, color: T.accent, cursor: 'pointer' }}>Forgot password?</span>
      </div>

      <SubmitBtn label="Sign in" />
      <OrDivider />
      <SsoButton label="Sign in with SSO" />
    </AuthLayout>
  );

  // ── Screen: Sign in — error state ──────────────────────────────────────────────
  const SignInErrorScreen = () => (
    <AuthLayout>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 4 }}>Sign in</div>
      <div style={{ fontSize: 13, color: T.tMuted, marginBottom: 28 }}>
        Don't have an account?{' '}
        <span style={{ color: T.accent, cursor: 'pointer' }}>Create one</span>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: T.rLg, marginBottom: 18 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--readion-status-poor)" strokeWidth="1.2"/><path d="M8 5v4M8 11h.01" stroke="var(--readion-status-poor)" strokeWidth="1.4" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 12, color: T.poor }}>Incorrect email or password.</span>
      </div>

      <Field label="Email" type="email" value="jamie@example.com" error="No account found with this email" />
      <Field label="Password" type="password" value="••••••••" suffix={<EyeIcon />} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 22 }}>
        <span style={{ fontSize: 12, color: T.accent, cursor: 'pointer' }}>Forgot password?</span>
      </div>

      <SubmitBtn label="Sign in" />
      <OrDivider />
      <SsoButton label="Sign in with SSO" />
    </AuthLayout>
  );

  // ── Screen: Register ────────────────────────────────────────────────────────────
  const RegisterScreen = () => (
    <AuthLayout>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 4 }}>Create your account</div>
      <div style={{ fontSize: 13, color: T.tMuted, marginBottom: 28 }}>
        Already have an account?{' '}
        <span style={{ color: T.accent, cursor: 'pointer' }}>Sign in</span>
      </div>

      <Field label="Full name" placeholder="Jamie Delacroix" value="Jamie Delacroix" />
      <Field label="Work email" type="email" placeholder="you@company.com" value="jamie@org.io" />
      <PasswordStrength strength={3} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 22 }}>
        <div style={{ width: 15, height: 15, borderRadius: 3, background: T.primary, border: '1px solid ' + T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5l2 2 3-3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span style={{ fontSize: 12, color: T.tMuted, lineHeight: 1.55 }}>
          I agree to the <span style={{ color: T.accent, cursor: 'pointer' }}>Terms of Service</span> and <span style={{ color: T.accent, cursor: 'pointer' }}>Privacy Policy</span>
        </span>
      </div>

      <SubmitBtn label="Create account" />
      <OrDivider />
      <SsoButton label="Sign up with SSO" />
    </AuthLayout>
  );

  // ── Screen: Forgot password ────────────────────────────────────────────────────
  const ForgotScreen = () => (
    <AuthLayout>
      <div style={{ marginBottom: 28 }}>
        <span style={{ fontSize: 12, color: T.accent, cursor: 'pointer' }}>&#8592; Back to sign in</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 4 }}>Reset your password</div>
      <div style={{ fontSize: 13, color: T.tMuted, marginBottom: 28, lineHeight: 1.6 }}>
        Enter your account email and we'll send a reset link. It expires in 15 minutes.
      </div>

      <Field label="Email" type="email" placeholder="you@example.com" value="jamie@org.io" />

      <SubmitBtn label="Send reset link" />
    </AuthLayout>
  );

  // ── Screen: Email sent (reset link) ─────────────────────────────────────────────
  const EmailSentScreen = () => (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 52, height: 52, borderRadius: T.rXl, background: 'rgba(52,211,153,0.1)', border: '1px solid var(--readion-status-good)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--readion-status-good)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 6 }}>Check your email</div>
        <div style={{ fontSize: 13, color: T.tMuted, lineHeight: 1.65, marginBottom: 28 }}>
          We sent a password reset link to{' '}
          <span style={{ color: T.tSecond, fontWeight: 500 }}>jamie@org.io</span>
        </div>

        <button style={{ width: '100%', padding: '10px 0', background: T.primary, color: '#fff', border: 'none', borderRadius: T.rMd, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
          Open email app
        </button>

        <div style={{ display: 'flex', gap: 20 }}>
          <span style={{ fontSize: 12, color: T.accent, cursor: 'pointer' }}>Resend link</span>
          <span style={{ fontSize: 12, color: T.tMuted, cursor: 'pointer' }}>Use a different email</span>
        </div>

        <div style={{ marginTop: 28, padding: '10px 14px', background: T.elevated, border: '1px solid ' + T.border, borderRadius: T.rLg }}>
          <div style={{ fontSize: 11, color: T.tSubtle, lineHeight: 1.55 }}>
            Didn't receive it? Check your spam folder, or wait a minute before resending. Link expires in <span style={{ color: T.tSecond }}>15 minutes</span>.
          </div>
        </div>
      </div>
    </AuthLayout>
  );

  // ── Screen: New password (reset) ────────────────────────────────────────────────
  const NewPasswordScreen = () => (
    <AuthLayout>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 4 }}>Choose a new password</div>
      <div style={{ fontSize: 13, color: T.tMuted, marginBottom: 28 }}>
        Make it something you haven't used before.
      </div>

      <PasswordStrength strength={4} />
      <Field label="Confirm password" type="password" value="••••••••••" suffix={
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="rgba(52,211,153,0.12)" stroke="var(--readion-status-good)" strokeWidth="1.2"/><path d="M5 8l2 2 4-4" stroke="var(--readion-status-good)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      } />

      <SubmitBtn label="Set new password" />
    </AuthLayout>
  );

  // ── Screen: Verify email (post-registration) ────────────────────────────────────
  const EmailVerifySentScreen = () => (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 52, height: 52, borderRadius: T.rXl, background: 'rgba(124,140,248,0.1)', border: '1px solid rgba(124,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--readion-accent-label)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 6 }}>Verify your email</div>
        <div style={{ fontSize: 13, color: T.tMuted, lineHeight: 1.65, marginBottom: 24 }}>
          We sent a link to <span style={{ color: T.tSecond, fontWeight: 500 }}>jamie@org.io</span>. Click it to activate your account before continuing.
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
          <span style={{ fontSize: 12, color: T.accent, cursor: 'pointer' }}>Resend link</span>
          <span style={{ fontSize: 12, color: T.tMuted, cursor: 'pointer' }}>Use a different email</span>
        </div>
        <div style={{ padding: '10px 14px', background: T.elevated, border: '1px solid ' + T.border, borderRadius: T.rLg }}>
          <div style={{ fontSize: 11, color: T.tSubtle, lineHeight: 1.55 }}>Didn't receive it? Check your spam folder. Link expires in <span style={{ color: T.tSecond }}>24 hours</span>.</div>
        </div>
      </div>
    </AuthLayout>
  );

  // ── Screen: Email verified — account activated ──────────────────────────────────
  const EmailVerifiedScreen = () => (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid var(--readion-status-good)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--readion-status-good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.good, marginBottom: 8 }}>Account activated</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.tPrimary, marginBottom: 6 }}>Email verified</div>
        <div style={{ fontSize: 13, color: T.tMuted, lineHeight: 1.65, marginBottom: 32 }}>
          Welcome to Readion, Jamie. Your account is ready — let's set you up.
        </div>
        <button style={{ width: '100%', maxWidth: 300, padding: '11px 0', background: T.primary, color: '#fff', border: 'none', borderRadius: T.rMd, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Continue to setup &#8594;
        </button>
      </div>
    </AuthLayout>
  );

  window.Auth = {
    T,
    BrandPanel, Field, EyeIcon, PasswordStrength, SubmitBtn, OrDivider, SsoButton, FormPanel, AuthLayout,
    SignInScreen, SignInErrorScreen, RegisterScreen, ForgotScreen, EmailSentScreen,
    NewPasswordScreen, EmailVerifySentScreen, EmailVerifiedScreen,
  };
})();
