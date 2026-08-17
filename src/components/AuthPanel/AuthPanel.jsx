'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import styles from './AuthPanel.module.scss';

export default function AuthPanel() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const supabase = createClient();
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) setMessage(error.message);
        else setMessage('If a seller account exists for this email, a password reset link is on its way.');
        return;
      }

      const { error, data } = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });

      if (error) setMessage(error.message);
      else if (mode === 'signup' && !data.session) setMessage('Check your email to confirm the account, then sign in.');
      else window.location.reload();
    } catch (error) {
      console.error('Supabase authentication failed:', error);
      setMessage(
        error?.code === 'SUPABASE_CONFIG_ERROR'
          ? 'Seller access is not configured. Please contact support.'
          : 'Seller access is temporarily unavailable. Please try again shortly.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.section
      className={styles.shell}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.intro}>
        <span>Seller sign in</span>
        <h1>Build a store<br />people remember.</h1>
        <p>Sign in to create your storefront, generate product visuals and publish your collection.</p>
        <p className={styles.buyerNote}>Shopping? No account needed. Open a boutique link and order directly on WhatsApp.</p>
      </div>
      <form onSubmit={submit}>
        {mode === 'forgot' ? (
          <div className={styles.resetIntro}>
            <span>Password recovery</span>
            <h2>Reset your password</h2>
            <p>Enter your seller email and we’ll send a secure reset link.</p>
          </div>
        ) : (
          <div className={styles.switcher}>
            <button type="button" className={mode === 'signin' ? styles.active : ''} onClick={() => { setMode('signin'); setMessage(''); }}>Seller sign in</button>
            <button type="button" className={mode === 'signup' ? styles.active : ''} onClick={() => { setMode('signup'); setMessage(''); }}>Create account</button>
          </div>
        )}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        {mode !== 'forgot' && <label>Password<input type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>}
        {mode === 'signin' && <button type="button" className={styles.textButton} onClick={() => { setMode('forgot'); setMessage(''); }}>Forgot password?</button>}
        <button className={styles.submit} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Open Seller Studio' : mode === 'signup' ? 'Create seller account' : 'Send reset link'}
        </button>
        {mode === 'forgot' && <button type="button" className={styles.textButton} onClick={() => { setMode('signin'); setMessage(''); }}>Back to seller sign in</button>}
        {message && <p className={styles.message} role="status" aria-live="polite">{message}</p>}
      </form>
    </motion.section>
  );
}
