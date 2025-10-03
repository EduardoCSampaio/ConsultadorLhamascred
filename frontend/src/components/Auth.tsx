import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Login successful!');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the confirmation link!');
    }
    setLoading(false);
  };

  return (
    <div className="modern-main" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f7f7f9 100%)' }}>
      <div className="modern-card" style={{ maxWidth: 400, padding: '2.5rem', textAlign: 'center' }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 18, color: '#2563eb', letterSpacing: 0.5 }}>Supabase Auth</h2>
        <p style={{ marginBottom: '1.5rem', color: '#666' }}>Faça login com seu email e senha.</p>
        <form onSubmit={handleLogin} className="modern-form">
          <div className="modern-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="inputField"
              type="email"
              placeholder="Seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="modern-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              className="inputField"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="modern-btn" disabled={loading}>
            {loading ? 'Carregando' : 'Login'}
          </button>
        </form>
        {message && <p className="modern-error" style={{ marginTop: '1.5rem' }}>{message}</p>}
      </div>
    </div>
  );
};

export default Auth;
