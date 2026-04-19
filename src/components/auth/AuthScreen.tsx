import { useState } from 'react';
import { supabase } from '../../lib/supabase';

type Mode = 'login' | 'register' | 'verify';

export function AuthScreen({ onAuth }: { onAuth: (id: string, email: string) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMode('verify');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) onAuth(data.user.id, data.user.email!);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const continueOffline = () => onAuth('local-user', 'local');

  if (mode === 'verify') {
    return (
      <Screen>
        <div style={{ fontSize: 36, marginBottom: 16 }}>📬</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check your email</h2>
        <p style={{ color: 'var(--tx3)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          We sent a verification link to<br />
          <strong style={{ color: 'var(--tx)' }}>{email}</strong>
        </p>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => setMode('login')}>Back to login</button>
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ind)', marginBottom: 6 }}>
        UpX
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.3px', marginBottom: 4 }}>
        {mode === 'login' ? 'Welcome back' : 'Create account'}
      </h1>
      <p style={{ color: 'var(--tx3)', fontSize: 13, marginBottom: 28 }}>
        {mode === 'login' ? 'Sign in to sync your tasks' : 'Start planning smarter'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

        {error && (
          <div style={{ fontSize: 12, color: 'var(--coral)', padding: '8px 10px', background: 'var(--coral-l)', borderRadius: 'var(--rs)' }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
          onClick={handleSubmit} disabled={loading || !email || !password}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? "No account? Sign up" : 'Have account? Sign in'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--bdr2)' }} />
          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--bdr2)' }} />
        </div>

        <button className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
          onClick={continueOffline}>
          Continue without account
        </button>
        <p style={{ fontSize: 10, color: 'var(--tx3)', textAlign: 'center', lineHeight: 1.5 }}>
          Data saved locally only. No cross-device sync.
        </p>
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: 'var(--sf)',
        borderRadius: 'var(--r)', border: '1px solid var(--bdr2)',
        padding: '36px 28px', boxShadow: 'var(--shd2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}
