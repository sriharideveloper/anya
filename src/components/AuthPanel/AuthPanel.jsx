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
    const supabase = createClient();

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
    setBusy(false);
  };

  return (
    <motion.section
      className={styles.shell}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.intro}>
        <span>Seller access</span>
        <h1>Build a store<br />people remember.</h1>
        <p>Sign in to create your storefront, generate product visuals and publish your collection.</p>
      </div>
      <form onSubmit={submit}>
        <div className={styles.switcher}>
          <button type="button" className={mode === 'signin' ? styles.active : ''} onClick={() => setMode('signin')}>Sign in</button>
          <button type="button" className={mode === 'signup' ? styles.active : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label>Password<input type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
        <button className={styles.submit} disabled={busy}>{busy ? 'Opening studio…' : mode === 'signin' ? 'Open my studio' : 'Create my account'}</button>
        {message && <p className={styles.message}>{message}</p>}
      </form>
    </motion.section>
  );
}
