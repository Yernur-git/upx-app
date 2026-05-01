import { useState } from 'react';
import { Eye, EyeOff, Mail, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Mode = 'login' | 'register' | 'forgot' | 'verify' | 'forgot-sent';

export function AuthScreen({ onAuth }: { onAuth: (id: string, email: string) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = (next: Mode) => { setError(''); setMode(next); };

  const handleSubmit = async () => {
    setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match'); return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters'); return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, phone } },
        });
        if (error) throw error;
        setMode('verify');
      } else if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) onAuth(data.user.id, data.user.email!);
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMode('forgot-sent');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const continueOffline = () => onAuth('local-user', 'local');

  // ── Verify screen ──
  if (mode === 'verify') return (
    <Screen>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--ind-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Mail size={28} color="var(--ind)" strokeWidth={1.5} /></div>
      <h2 style={h2}>Check your email</h2>
      <p style={sub}>We sent a verification link to<br /><strong style={{ color: 'var(--tx)' }}>{email}</strong></p>
      <Btn onClick={() => reset('login')} ghost>Back to Sign In</Btn>
    </Screen>
  );

  // ── Forgot sent screen ──
  if (mode === 'forgot-sent') return (
    <Screen>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--ind-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Send size={28} color="var(--ind)" strokeWidth={1.5} /></div>
      <h2 style={h2}>Reset link sent</h2>
      <p style={sub}>Check your inbox for a password reset link.</p>
      <Btn onClick={() => reset('login')} ghost>Back to Sign In</Btn>
    </Screen>
  );

  // ── Forgot password screen ──
  if (mode === 'forgot') return (
    <Screen>
      <Logo />
      <h1 style={h1}>Reset password</h1>
      <p style={sub}>Enter your email and we'll send a reset link.</p>
      <div style={form}>
        <Field label="Email">
          <input type="email" placeholder="you@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </Field>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Btn onClick={handleSubmit} disabled={loading || !email}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Btn>
        <Btn onClick={() => reset('login')} ghost>Back to Sign In</Btn>
      </div>
    </Screen>
  );

  // ── Main login / register ──
  return (
    <Screen>
      <Logo />

      {/* Mode tabs */}
      <div style={{ display: 'flex', width: '100%', background: 'var(--sf2)', borderRadius: 12, padding: 4, marginBottom: 24, gap: 4 }}>
        {(['login', 'register'] as const).map(m => (
          <button key={m} onClick={() => reset(m)} style={{
            flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: mode === m ? 'var(--sf)' : 'transparent',
            color: mode === m ? 'var(--tx)' : 'var(--tx3)',
            boxShadow: mode === m ? '0 1px 6px rgba(0,0,0,.08)' : 'none',
            transition: 'all .18s ease',
          }}>
            {m === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <div style={form}>
        {mode === 'register' && (
          <>
            <Field label="Full name">
              <input placeholder="John Appleseed" value={fullName}
                onChange={e => setFullName(e.target.value)} />
            </Field>
            <Field label="Phone (optional)">
              <input type="tel" placeholder="+1 555 000 0000" value={phone}
                onChange={e => setPhone(e.target.value)} />
            </Field>
          </>
        )}

        <Field label="Email">
          <input type="email" placeholder="you@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </Field>

        <Field label="Password">
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ paddingRight: 40 }} />
            <button onClick={() => setShowPass(!showPass)} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', padding: 2,
            }}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        {mode === 'register' && (
          <Field label="Confirm password">
            <input type={showPass ? 'text' : 'password'} placeholder="Repeat password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </Field>
        )}

        {mode === 'login' && (
          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <button onClick={() => reset('forgot')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--ind)', fontFamily: 'inherit',
            }}>
              Forgot password?
            </button>
          </div>
        )}

        {error && <ErrorBox>{error}</ErrorBox>}

        <Btn onClick={handleSubmit} disabled={loading || !email || !password}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </Btn>

        <Divider />

        <Btn onClick={continueOffline} ghost>Continue without account</Btn>
        <p style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center', lineHeight: 1.5, marginTop: -4 }}>
          Data saved locally only · No sync
        </p>
      </div>
    </Screen>
  );
}

// ── Shared styles ──
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, letterSpacing: '-.3px', marginBottom: 4, textAlign: 'center' };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' };
const sub: React.CSSProperties = { color: 'var(--tx3)', fontSize: 13, lineHeight: 1.6, marginBottom: 24, textAlign: 'center' };
const form: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, width: '100%' };

function Logo() {
  return (
    <div style={{ marginBottom: 20, textAlign: 'center' }}>
      <img src="/logo.png" alt="UpX" style={{ height: 36 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ind)', marginTop: 4 }}>UpX</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)' }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--coral)', padding: '9px 12px', background: 'var(--coral-l)', borderRadius: 8, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

function Btn({ onClick, children, disabled, ghost }: { onClick: () => void; children: React.ReactNode; disabled?: boolean; ghost?: boolean }) {
  return (
    <button
      className={ghost ? 'btn btn-ghost' : 'btn btn-primary'}
      style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, fontWeight: 600 }}
      onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--bdr2)' }} />
      <span style={{ fontSize: 11, color: 'var(--tx3)' }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'var(--bdr2)' }} />
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--sf)', borderRadius: 20, border: '1px solid var(--bdr2)', padding: '32px 28px', boxShadow: 'var(--shd2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  );
}
