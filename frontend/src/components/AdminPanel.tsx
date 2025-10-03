import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaUserCircle } from 'react-icons/fa';

interface UserProfile {
  id: string;
  email: string;
  role: string;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Estados para o novo usuário
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Você precisa estar logado para acessar o painel de administração.");
        setLoading(false);
        return;
      }

      // Alterado para o novo endpoint de listagem de usuários
      const res = await fetch('/api/admin/users-list', { // Alterado para rota relativa
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (res.status === 403) {
        setError("Acesso negado: Você não tem permissão de administrador.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error('Erro ao buscar usuários');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setError(null);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Você precisa estar logado para criar usuários.");
        setCreatingUser(false);
        return;
      }

      const res = await fetch('/api/admin/users', { // Alterado para rota relativa
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });

      if (res.status === 403) {
        setError("Acesso negado: Você não tem permissão de administrador para criar usuários.");
        setCreatingUser(false);
        return;
      }
      if (!res.ok) {
        let errorMessage = 'Erro ao criar usuário';
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          // Se não for JSON, tentar ler como texto ou usar uma mensagem genérica
          const errorText = await res.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      // Se a resposta for OK, mas sem conteúdo (ex: 204 No Content), não tentar parsear
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        await res.json(); // Apenas para consumir a resposta se houver
      }
      setMessage('Usuário criado com sucesso!');
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers(); // Recarregar usuários após a criação
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Você precisa estar logado para alterar funções.");
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}/role`, { // Alterado para rota relativa
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.status === 403) {
        setError("Acesso negado: Você não tem permissão de administrador para alterar funções.");
        return;
      }
      if (!res.ok) {
        throw new Error('Erro ao atualizar função do usuário');
      }
      setMessage('Função atualizada com sucesso!');
      fetchUsers(); // Recarregar usuários após a atualização
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar função');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Você precisa estar logado para excluir usuários.");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}`, { // Alterado para rota relativa
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (res.status === 403) {
        setError("Acesso negado: Você não tem permissão de administrador para excluir usuários.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error('Erro ao excluir usuário');
      }
      setMessage('Usuário excluído com sucesso!');
      fetchUsers(); // Recarregar usuários após a exclusão
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir usuário');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="modern-dashboard">
        <div className="modern-sidebar">
          <div className="modern-logo">Admin Panel</div>
          <nav>
            <ul>
              <li className="active"><span>👥</span> Usuários</li>
            </ul>
          </nav>
        </div>
        <main className="modern-main">
          <div className="modern-card" style={{ textAlign: 'center' }}>
            <FaSpinner className="spin" style={{ fontSize: 30, color: '#2563eb' }} />
            <p style={{ marginTop: 15, fontSize: 18, color: '#444' }}>Carregando usuários...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(120deg, #f7f7f9 70%, #e0e7ff 100%)' }}>
      <header style={{ width: '100%', background: 'rgba(255,255,255,0.98)', borderBottom: '1.5px solid #e0e7ff', padding: '0.7rem 0', marginBottom: 32, boxShadow: '0 2px 16px 0 #2563eb0a', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FaUserCircle style={{ fontSize: 32, color: '#2563eb', background: '#e0e7ff', borderRadius: '50%' }} />
            <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: 1.2, color: '#2563eb' }}>Admin Panel</span>
          </div>
          <button className="button block" onClick={() => supabase.auth.signOut()} style={{ margin: 0, padding: '8px 16px', fontSize: 14 }}>Logout</button>
        </div>
      </header>
      <main style={{ minHeight: '80vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '0 1rem' }}>
        <section style={{ width: '100%', maxWidth: 900 }}>
          <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 25, color: '#2563eb', letterSpacing: 0.5 }}>Gerenciamento de Usuários</h2>

          {/* Formulário de Criação de Usuário */}
          <div className="modern-card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 15, color: '#2563eb' }}>Criar Novo Usuário</h3>
            <form onSubmit={handleCreateUser} className="modern-form" style={{ gap: '1rem' }}>
              <div className="modern-field">
                <label htmlFor="newEmail">Email</label>
                <input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div className="modern-field">
                <label htmlFor="newPassword">Senha</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="********"
                  required
                />
              </div>
              <div className="modern-field">
                <label htmlFor="newRole">Função</label>
                <select
                  id="newRole"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="modern-btn" disabled={creatingUser}>
                {creatingUser ? <FaSpinner className="spin" /> : 'Criar Usuário'}
              </button>
            </form>
            {error && <div className="modern-error" style={{ marginTop: '1rem' }}><FaTimesCircle style={{ marginRight: 6 }} />{error}</div>}
            {message && <div className="modern-success" style={{ marginTop: '1rem', background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' }}><FaCheckCircle style={{ marginRight: 6 }} />{message}</div>}
          </div>

          {/* Lista de Usuários Existentes */}
          <div className="modern-card">
            <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 15, color: '#2563eb' }}>Usuários Existentes</h3>
            {users.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Nenhum usuário encontrado.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 15, fontSize: 15 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: 10 }}>Email</th>
                      <th style={{ textAlign: 'left', padding: 10 }}>Função</th>
                      <th style={{ textAlign: 'left', padding: 10 }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: 10 }}>{user.email}</td>
                        <td style={{ padding: 10 }}>
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff' }}
                          >
                            <option value="user">Usuário</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td style={{ padding: 10 }}>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
      <footer style={{ color: '#888', fontSize: 15, opacity: 0.7, textAlign: 'center', padding: '2.5rem 0 1.2rem 0', borderTop: '1px solid #e5e7eb', marginTop: 32 }}>
        Sistema de Consultas &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default AdminPanel;
