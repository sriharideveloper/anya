'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import styles from './ResetPasswordPanel.module.scss';

export default function ResetPasswordPanel() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    try {
      const supabase = createClient();
      const checkSession = async () => {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        setRecoveryReady(Boolean(data.session));
        if (error) setMessage(error.message);
        setChecking(false);
      };
      checkSession();

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === 'PASSWORD_RECOVERY' || session) setRecoveryReady(true);
        setChecking(false);
      });

      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Supabase password recovery initialization failed:', error);
      setMessage('Password recovery is temporarily unavailable. Please try again shortly.');
      setChecking(false);
    }

    return () => { active = false; };
  }, []);

  const updatePassword = async (event) => {
    event.preventDefault();
    setMessage('');

    if (password.length < 8) {
      setMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmation) {
      setMessage('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) setMessage(error.message);
      else {
        setComplete(true);
        setMessage('Your password has been updated.');
      }
    } catch (error) {
      console.error('Supabase password update failed:', error);
      setMessage('Could not update your password. Please request a new reset link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.main
      className={styles.shell}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}
    >
      <section className={styles.card}>
        <div className={styles.mark} aria-hidden="true" />
        <span className={styles.eyebrow}>Seller security</span>
        <h1>Choose a new password.</h1>
        <p className={styles.copy}>Create a strong password for your Anya seller account.</p>

        {checking ? (
          <p className={styles.message} role="status">Checking your reset link…</p>
        ) : complete ? (
          <div className={styles.complete}>
            <p className={styles.message} role="status" aria-live="polite">{message}</p>
            <Link className={styles.primaryLink} href="/dashboard">Continue to Seller Studio</Link>
          </div>
        ) : recoveryReady ? (
          <form onSubmit={updatePassword}>
            <label>New password<input type="password" minLength="8" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirm new password<input type="password" minLength="8" required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <button className={styles.submit} disabled={busy}>{busy ? 'Updating password…' : 'Update password'}</button>
            {message && <p className={styles.message} role="status" aria-live="polite">{message}</p>}
          </form>
        ) : (
          <div className={styles.invalid}>
            <p className={styles.message} role="alert">{message || 'This reset link is invalid or has expired.'}</p>
            <Link href="/dashboard">Request a new reset link</Link>
          </div>
        )}
      </section>
    </motion.main>
  );
}
