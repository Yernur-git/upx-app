import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function PasswordResetScreen({ onDone }: { onDone: (id: string, email: string) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (password.length < 6) { setError('Minimum 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      // Auto-login after reset
      setTimeout(() => {
        const user = data.user;
        if (user) onDone(user.id, user.email ?? 'local');
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <Screen>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={h2}>Password updated!</h2>
      <p style={sub}>Logging you in…</p>
    </Screen>
  );

  return (
    <Screen>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
      <h1 style={h1}>Set new password</h1>
      <p style={sub}>Choose a strong password for your account.</p>

      <div style={form}>
        <div>
          <label style={label}>New password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ paddingRight: 44 }}
            />
            <button
              onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', padding: 2 }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label style={label}>Confirm password</label>
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="Repeat password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--coral)', padding: '9px 12px', background: 'var(--coral-l)', borderRadius: 8, lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, fontWeight: 600 }}
          onClick={handleSubmit}
          disabled={loading || !password || !confirm}>
          {loading ? 'Saving…' : 'Set password'}
        </button>
      </div>
    </Screen>
  );
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, letterSpacing: '-.3px', marginBottom: 4, textAlign: 'center' };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' };
const sub: React.CSSProperties = { color: 'var(--tx3)', fontSize: 13, lineHeight: 1.6, marginBottom: 24, textAlign: 'center' };
const form: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, width: '100%' };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--tx2)', display: 'block', marginBottom: 6 };

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--sf)', borderRadius: 20, border: '1px solid var(--bdr2)', padding: '32px 28px', boxShadow: 'var(--shd2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  );
}
