import React, { useState, useEffect } from 'react';
import './ultraclean.css'; // Alterado de dashboard-clean.css para ultraclean.css
import './animated.css';
import ReactDOM from 'react-dom/client';
import { FaUserCircle, FaCheckCircle, FaTimesCircle, FaFileExcel, FaSpinner } from 'react-icons/fa';
import {
	BrowserRouter as Router,
	Routes,
	Route,
	useNavigate,
	useParams,
} from 'react-router-dom';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import { Link } from 'react-router-dom'; // Importar Link
import AdminPanel from './components/AdminPanel'; // Importar AdminPanel

const tabs = [
	{ key: 'fgts-manual', label: 'Consulta Manual FGTS' },
	{ key: 'fgts-lote', label: 'Consulta em Lote FGTS' },
	{ key: 'clt', label: 'Consulta Saldo CLT', soon: true },
];

const providers = [
	{ label: 'Cartos', value: 'cartos' },
	{ label: 'BMS', value: 'bms' },
	{ label: 'QI', value: 'qi' },
];


const AnimatedCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
	<div
		className="modern-card animated-card"
		style={{
			margin: '0 auto',
			marginTop: 32,
			boxShadow: '0 8px 32px 0 #2563eb22',
			border: '1.5px solid #2563eb22',
			borderRadius: 18,
			background: 'linear-gradient(135deg, #fff 80%, #e0e7ff 100%)',
			transition: 'box-shadow 0.25s, transform 0.18s',
			...style,
		}}
	>
		{children}
	</div>
);

const Loader = () => (
	<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', fontWeight: 600, fontSize: 16 }}>
		<FaSpinner className="spin" style={{ fontSize: 20 }} /> Carregando...
	</div>
);

// Hook para controlar o modal de relatório
function useRelatorioModal() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<any>(null);
  const [documentNumber, setDocumentNumber] = React.useState<string>('');
  const show = (doc: string, relData?: any) => {
    setDocumentNumber(doc);
    if (relData) {
      setData(relData);
      setOpen(true);
    } else {
      setData(null);
      setOpen(true);
      fetch('/api/consulta-status/${doc}')
        .then(r => r.json())
        .then(d => setData(d.resultado || d));
    }
  };
  const hide = () => setOpen(false);
  return { open, data, documentNumber, show, hide };
}

const App = () => {
	const [documentNumber, setDocumentNumber] = useState('');
	const [provider, setProvider] = useState('cartos');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [consultaId, setConsultaId] = useState<string | null>(null);
		const [webhookData, setWebhookData] = useState<any>(null);
	const [waitingWebhook, setWaitingWebhook] = useState(false);
		const [tab, setTab] = useState<'fgts-manual' | 'fgts-lote' | 'clt'>('fgts-manual');
		const navigate = typeof window !== 'undefined' && (window as any).location ? useNavigate() : () => {};
	const [excelFile, setExcelFile] = useState<File | null>(null);
	const [excelLoading, setExcelLoading] = useState(false);
	const [excelError, setExcelError] = useState('');
	const [excelResultUrl, setExcelResultUrl] = useState<string | null>(null);
	const [session, setSession] = useState<any>(null);
	const [userRole, setUserRole] = useState<string | null>(null);

	// Simulação: buscar resultado do webhook periodicamente
	React.useEffect(() => {
		if (!waitingWebhook || !consultaId) return;
		const interval = setInterval(async () => {
			try {
				const { data: { session } } = await supabase.auth.getSession();
				if (!session) {
					console.error("Usuário não autenticado para buscar status do webhook.");
					setWaitingWebhook(false);
					setLoading(false);
					return;
				}
				const res = await fetch('/api/consulta-status/${consultaId}', {
					headers: { 'Authorization': `Bearer ${session.access_token}` }
				});
				if (res.status === 401) {
					setError("Sessão expirada ou inválida. Por favor, faça login novamente.");
					setWaitingWebhook(false);
					setLoading(false);
					return;
				}
				if (res.ok) {
					const data = await res.json();
					if (data && data.status === 'finalizado') {
						setWebhookData(data.resultado);
						setWaitingWebhook(false);
						setLoading(false);
					}
				}
			} catch {}
		}, 2000);
		return () => clearInterval(interval);
	}, [waitingWebhook, consultaId]);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
		});

		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
		});

		return () => subscription.unsubscribe();
	}, []);

	// Efeito para buscar a role do usuário quando a sessão muda
	useEffect(() => {
		const fetchUserRole = async () => {
			if (session?.user) {
				// Alterado para buscar a role do backend
				try {
					const res = await fetch(`/api/user-role/${session.user.id}`, { // Alterado para rota relativa
						headers: { 'Authorization': `Bearer ${session.access_token}` }
					});
					if (!res.ok) {
						throw new Error('Failed to fetch user role from backend');
					}
					const data = await res.json();
					setUserRole(data.role);
				} catch (error) {
					console.error('Error fetching user role:', error);
					setUserRole(null);
				}
			} else {
				setUserRole(null);
			}
		};
		fetchUserRole();
	}, [session]);

			const handleSubmit = async (e: React.FormEvent) => {
			e.preventDefault();
			setLoading(true);
			setError('');
			setWebhookData(null);
			setConsultaId(null);
			setWaitingWebhook(false);

			const { data: { session } } = await supabase.auth.getSession();
			if (!session) {
				setError("Você precisa estar logado para realizar consultas.");
				setLoading(false);
				return;
			}

			try {
					const res = await fetch('/api/consultaFGTSv8', {
						method: 'POST',
						headers: { 
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${session.access_token}`
						},
						body: JSON.stringify({ documentNumber, provider }),
					});
					if (res.status === 401) {
						setError("Sessão expirada ou inválida. Por favor, faça login novamente.");
						setLoading(false);
						return;
					}
					const data = await res.json();
					if (data.error) {
						setError('Erro ao consultar, cliente não liberou no aplicativo');
						setLoading(false);
						return;
					}
					// Exibe o relatório em modal
					if (data.documentNumber) {
						relatorioModal.show(data.documentNumber, data);
						setLoading(false);
						return;
					}
					if (data.consultaId) {
						setConsultaId(data.consultaId);
						setWaitingWebhook(true);
					} else {
						setLoading(false);
					}
				} catch (err) {
					setError('Erro ao enviar consulta');
					setLoading(false);
				}
		};

			const relatorioModal = useRelatorioModal();
			if (!session) {
				return (
					<div /* className="modern-page" */ style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f7f7f9 100%)' }}>
						<Auth />
					</div>
				);
			}
			return (
				<>
					<Routes>
						<Route path="/" element={<MainApp 
							documentNumber={documentNumber}
							setDocumentNumber={setDocumentNumber}
							provider={provider}
							setProvider={setProvider}
							loading={loading}
							error={error}
							consultaId={consultaId}
							webhookData={webhookData}
							waitingWebhook={waitingWebhook}
							tab={tab}
							setTab={setTab}
							excelFile={excelFile}
							setExcelFile={setExcelFile}
							excelLoading={excelLoading}
							excelError={excelError}
							excelResultUrl={excelResultUrl}
							setExcelLoading={setExcelLoading}
							setExcelError={setExcelError}
							setExcelResultUrl={setExcelResultUrl}
							handleSubmit={handleSubmit}
							session={session}
							userRole={userRole}
						/>} />
						<Route path="/admin" element={<AdminPanel />} />
					</Routes>
					<RelatorioModal open={relatorioModal.open} onClose={relatorioModal.hide} data={relatorioModal.data} documentNumber={relatorioModal.documentNumber} />
				</>
			);
		}

	// Card de resultado expansível
	function ExpandableResult({ webhookData, documentNumber }: { webhookData: any, documentNumber: string }) {
		const [open, setOpen] = React.useState(false);
		return (
			<div className="modern-result" style={{ marginTop: 18, border: '1px solid #e0e7ff', borderRadius: 10, background: '#f8fafc', boxShadow: '0 2px 8px 0 #2563eb11', padding: 18 }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
					<div style={{ fontWeight: 700, color: '#2563eb', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
						<FaCheckCircle style={{ color: '#22c55e' }} /> Resultado FGTS
					</div>
					<span style={{ fontSize: 14, color: '#2563eb', fontWeight: 600 }}>{open ? 'Ocultar detalhes ▲' : 'Ver detalhes ▼'}</span>
				</div>
				<div style={{ marginTop: 10 }}>
					<div><b>Cliente:</b> {webhookData.clientName || '-'}</div>
					<div><b>CPF/CNPJ:</b> {webhookData.documentNumber || documentNumber}</div>
					<div><b>Saldo:</b> {webhookData.balance !== undefined ? `R$ ${Number(webhookData.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</div>
				</div>
				{open && (
					<div style={{ marginTop: 12, borderTop: '1px solid #e0e7ff', paddingTop: 10 }}>
						{Object.keys(webhookData).filter(k => !['clientName','documentNumber','balance','errorMessage'].includes(k)).length === 0 && (
							<div style={{ color: '#888' }}>Sem detalhes adicionais.</div>
						)}
						{Object.keys(webhookData).filter(k => !['clientName','documentNumber','balance','errorMessage'].includes(k)).map(k => (
							<div key={k}><b>{k}:</b> {String(webhookData[k])}</div>
						))}
					</div>
				)}
			</div>
		);
	}
// Componente principal da aplicação (tela inicial)
function MainApp(props: any) {
	const {
		documentNumber, setDocumentNumber,
		provider, setProvider,
		loading, error, consultaId, webhookData, waitingWebhook,
		tab, setTab,
		excelFile, setExcelFile, excelLoading, excelError, excelResultUrl,
		setExcelLoading, setExcelError, setExcelResultUrl,
		handleSubmit,
		session, // Adicionar session aqui
		userRole // Adicionar userRole aqui
	} = props;

	// Estado para controlar o modal de Lotes Higienizados
	const [showLotes, setShowLotes] = React.useState(false);

	const handleExcelSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setExcelError('');
		setExcelResultUrl(null);
		if (!excelFile) {
			setExcelError('Selecione um arquivo Excel');
			return;
		}
		setExcelLoading(true);

		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			setExcelError("Você precisa estar logado para processar lotes.");
			setExcelLoading(false);
			return;
		}

		try {
			const formData = new FormData();
			formData.append('file', excelFile);
			formData.append('provider', provider);
			const res = await fetch('/api/consulta-excel', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${session.access_token}`
				},
				body: formData,
			});
			
			if (res.status === 401) {
				setExcelError("Sessão expirada ou inválida. Por favor, faça login novamente.");
				setExcelLoading(false);
				return;
			}

			if (!res.ok) throw new Error('Erro ao processar Excel');
			const data = await res.json(); // Assumindo que a resposta agora é JSON com loteId
			// Em vez de baixar diretamente, agora você pode querer exibir o status do lote
			// Por enquanto, vamos manter o download se o backend ainda retornar o blob diretamente
			// Se o backend retornar um loteId, você precisará buscar o status do lote e o URL de download
			// Para simplificar, vou assumir que o backend ainda retorna o blob para download imediato após o upload
			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			setExcelResultUrl(url);
		} catch (err: any) {
			setExcelError(err?.message || 'Erro ao processar Excel');
		}
		setExcelLoading(false);
	};

	return (
		<div style={{ minHeight: '100vh', background: 'linear-gradient(120deg, #f7f7f9 70%, #e0e7ff 100%)' }}>
			{/* Topbar aprimorada */}
			<header style={{ width: '100%', background: 'rgba(255,255,255,0.98)', borderBottom: '1.5px solid #e0e7ff', padding: '0.7rem 0', marginBottom: 32, boxShadow: '0 2px 16px 0 #2563eb0a', position: 'sticky', top: 0, zIndex: 10 }}>
				<div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
						<FaUserCircle style={{ fontSize: 32, color: '#2563eb', background: '#e0e7ff', borderRadius: '50%' }} />
						<span style={{ fontWeight: 800, fontSize: 22, letterSpacing: 1.2, color: '#2563eb' }}>Sistema de Consultas</span>
					</div>
					<nav style={{ display: 'flex', gap: 0 }}>
						{tabs.map(t => (
							<button
								key={t.key}
								onClick={() => !t.soon && setTab(t.key as any)}
								style={{
									background: 'none',
									border: 'none',
									borderBottom: tab === t.key ? '3px solid #2563eb' : '3px solid transparent',
									color: t.soon ? '#bbb' : tab === t.key ? '#2563eb' : '#222',
									fontWeight: tab === t.key ? 800 : 500,
									fontSize: 16,
									padding: '0.7rem 1.2rem',
									cursor: t.soon ? 'not-allowed' : 'pointer',
									opacity: t.soon ? 0.5 : 1,
									outline: 'none',
									borderRadius: 0,
									transition: 'color 0.13s, border-bottom 0.13s',
								}}
								disabled={!!t.soon}
							>
								{t.label}
								{t.soon && <span style={{ fontSize: 12, marginLeft: 6, background: '#e5e7eb', color: '#2563eb', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>EM BREVE</span>}
							</button>
						))}
						{session && userRole === 'admin' && (
							<Link to="/admin" style={{
								background: 'none',
								border: 'none',
								borderBottom: '3px solid transparent',
								color: '#222',
								fontWeight: 500,
								fontSize: 16,
								padding: '0.7rem 1.2rem',
								cursor: 'pointer',
								outline: 'none',
								borderRadius: 0,
								transition: 'color 0.13s, border-bottom 0.13s',
								textDecoration: 'none'
							}}>
								Admin
							</Link>
						)}
					</nav>
					<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
						{session && (
							<div style={{ fontSize: 14, color: '#444', textAlign: 'right' }}>
								<p style={{ margin: 0, fontWeight: 600 }}>{session.user.email}</p>
								<p style={{ margin: 0, fontSize: 12, color: '#666' }}>Role: {userRole}</p>
							</div>
						)}
						<button className="button block" onClick={() => supabase.auth.signOut()} style={{ margin: 0, padding: '8px 16px', fontSize: 14 }}>Logout</button>
					</div>
				</div>
			</header>
			<main style={{ minHeight: '80vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '0 1rem' }}>
				<section style={{ width: '100%', maxWidth: 440 }}>
					{tab === 'fgts-manual' && (
						<AnimatedCard>
							<h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 18, color: '#2563eb', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
								<FaCheckCircle style={{ color: '#2563eb', fontSize: 20 }} /> Consulta Manual FGTS
							</h2>
							<form onSubmit={handleSubmit} className="modern-form" style={{ marginBottom: 12 }}>
								<div className="modern-field">
									<label>Número do documento</label>
									<input
										type="text"
										value={documentNumber}
										onChange={e => setDocumentNumber(e.target.value)}
										required
										placeholder="Digite o CPF/CNPJ"
									/>
								</div>
								<div className="modern-field">
									<label>Provedor</label>
									<select
										value={provider}
										onChange={e => setProvider(e.target.value)}
									>
										{providers.map(p => (
											<option key={p.value} value={p.value}>{p.label}</option>
										))}
									</select>
								</div>
								<button type="submit" disabled={loading} className="modern-btn">
									{loading ? <Loader /> : 'Consultar'}
								</button>
							</form>
							{error && <div className="modern-error"><FaTimesCircle style={{ color: '#e11d48', marginRight: 6 }} />{error}</div>}
							{waitingWebhook && (
								<div className="modern-waiting"><Loader /> Aguardando resposta do provedor...</div>
							)}
							{webhookData && (
								webhookData.errorMessage ? (
									<div className="modern-error"><FaTimesCircle style={{ color: '#e11d48', marginRight: 6 }} />Erro ao consultar, cliente não liberou no aplicativo</div>
								) : (
									<ExpandableResult webhookData={webhookData} documentNumber={documentNumber} />
								)
							)}
						</AnimatedCard>
					)}
					{tab === 'fgts-lote' && (
						<AnimatedCard>
							<h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 18, color: '#2563eb', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
								<FaFileExcel style={{ color: '#22c55e', fontSize: 20 }} /> Consulta em Lote FGTS (Excel)
							</h2>
							<p style={{ marginBottom: '1.2rem', color: '#444' }}>
								Faça upload de um arquivo Excel (.xlsx) com uma coluna <b>documentNumber</b>.<br />
								O sistema irá consultar todos os documentos e gerar um novo Excel com os resultados.
							</p>
							<form
								onSubmit={handleExcelSubmit}
								style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}
							>
								<div className="modern-field">
									<label>Arquivo Excel (.xlsx)</label>
									<input
										type="file"
										accept=".xlsx"
										onChange={e => setExcelFile(e.target.files?.[0] || null)}
										required
									/>
								</div>
								<div className="modern-field">
									<label>Provedor</label>
									<select
										value={provider}
										onChange={e => setProvider(e.target.value)}
									>
										{providers.map(p => (
											<option key={p.value} value={p.value}>{p.label}</option>
										))}
									</select>
								</div>
								<button type="submit" className="modern-btn" disabled={excelLoading}>
									{excelLoading ? <Loader /> : 'Enviar e Consultar'}
								</button>
							</form>
							{excelError && <div className="modern-error"><FaTimesCircle style={{ color: '#e11d48', marginRight: 6 }} />{excelError}</div>}
							{excelResultUrl && (
								<div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
									<a href={excelResultUrl} download="resultados.xlsx" className="modern-btn" style={{ background: '#2563eb', color: '#fff', margin: 0 }}>
										<FaFileExcel style={{ marginRight: 6 }} /> Baixar resultados (.xlsx)
									</a>
								</div>
							)}
							<button type="button" className="modern-btn" style={{ background: '#f1f5f9', color: '#2563eb', marginBottom: 12, marginRight: 8 }} onClick={() => setShowLotes(true)}>
  Ver Lotes Higienizados
</button>
<LotesHigienizadosModal open={showLotes} onClose={() => setShowLotes(false)} />
						</AnimatedCard>
					)}
					{tab === 'clt' && (
						<AnimatedCard style={{ textAlign: 'center', opacity: 0.7 }}>
							<h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 18, color: '#2563eb', letterSpacing: 0.5 }}>Consulta Saldo CLT</h2>
							<p style={{ fontSize: '1.1rem', margin: '2rem 0' }}>Em breve você poderá consultar o saldo CLT por aqui!</p>
							<span style={{ fontSize: '1rem', background: '#e5e7eb', color: '#2563eb', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>EM BREVE</span>
						</AnimatedCard>
					)}
				</section>
			</main>
			<footer style={{ color: '#888', fontSize: 15, opacity: 0.7, textAlign: 'center', padding: '2.5rem 0 1.2rem 0', borderTop: '1px solid #e5e7eb', marginTop: 32 }}>
				Sistema de Consultas &copy; {new Date().getFullYear()}
			</footer>
		</div>
	);
}

// Funções globais para data/hora padrão Brasilia
function formatDate(dateStr?: string) {
	if (!dateStr) return '-';
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
	} catch { return '-'; }
}
function formatTime(dateStr?: string) {
	if (!dateStr) return '-';
	try {
		const date = new Date(dateStr);
		return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
	} catch { return '-'; }
}

// Componente de relatório detalhado
function RelatorioModal({ open, onClose, data, documentNumber }: { open: boolean, onClose: () => void, data: any, documentNumber: string }) {
	if (!open) return null;
	if (!data) return (
		<div className="modal-overlay">
			<div className="modal-content">
				<Loader />
			</div>
		</div>
	);
	// Campos já exibidos explicitamente
	const shownFields = [
		'documentNumber', 'clientName', 'balance', 'provider', 'timestamp', 'installments', 'errorMessage', 'status', 'type', 'consultaId', 'balanceId'
	];
	return (
		<div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(30,41,59,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
			<div className="modal-content" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px 0 #2563eb33', padding: 32, minWidth: 340, maxWidth: 480, position: 'relative' }}>
				<button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer', fontWeight: 700 }}>×</button>
				<h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 18, color: '#2563eb' }}>Relatório do Documento</h2>
				<div style={{ marginBottom: 18, fontSize: 16 }}>
					<b>CPF/CNPJ:</b> {data.documentNumber || documentNumber}<br />
					<b>Provedor:</b> {data.provider || '-'}<br />
					<b>Status:</b> {data.type || data.status || '-'}<br />
					<b>Saldo:</b> {data.balance !== undefined ? `R$ ${Number(data.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}<br />
					{data.balanceId && (<><b>ID Saldo:</b> {data.balanceId}<br /></>)}
					{data.timestamp && (<><b>Data/Hora:</b> {formatDate(data.timestamp)} {formatTime(data.timestamp)}<br /></>)}
				</div>
				{data.installments && Array.isArray(data.installments) && data.installments.length > 0 && (
					<div style={{ marginBottom: 18 }}>
						<b>Parcelas:</b>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 15 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: 4 }}>Vencimento</th>
                  <th style={{ textAlign: 'left', padding: 4 }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.installments.map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 4 }}>{p.dueDate}</td>
                    <td style={{ padding: 4 }}>R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.errorMessage && (
          <div style={{ color: '#e11d48', fontWeight: 600, marginBottom: 12 }}>
            <FaTimesCircle style={{ marginRight: 6 }} /> {data.errorMessage}
          </div>
        )}
        {/* Exibir campos extras não exibidos explicitamente */}
				{Object.keys(data).filter(k => !shownFields.includes(k)).length > 0 && (
					<div style={{ marginTop: 18 }}>
						<b>Outros detalhes:</b>
						<ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none', fontSize: 15 }}>
							{Object.entries(data).filter(([k]) => !shownFields.includes(k)).map(([k, v]) => {
								// Se for campo de data/hora, tenta formatar
								if (typeof v === 'string' && /data|hora|timestamp/i.test(k)) {
									return <li key={k}><b>{k}:</b> {formatDate(v)} {formatTime(v)}</li>;
								}
								return <li key={k}><b>{k}:</b> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>;
							})}
						</ul>
					</div>
				)}
      </div>
    </div>
  );
}

// Componente Modal de Lotes Higienizados
function LotesHigienizadosModal({ open, onClose }: { open: boolean, onClose: () => void }) {
	const [lotes, setLotes] = React.useState<any[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	React.useEffect(() => {
		if (!open) return;
		setLoading(true);
		setError(null);
		const fetchLotes = async () => {
			try {
				const { data: { session } } = await supabase.auth.getSession();
				if (!session) {
					setError("Você precisa estar logado para ver os lotes.");
					setLoading(false);
					return;
				}
				const res = await fetch('/api/lotes-higienizados', {
					headers: { 'Authorization': `Bearer ${session.access_token}` }
				});
				if (res.status === 401) {
					setError("Sessão expirada ou inválida. Por favor, faça login novamente.");
					setLoading(false);
					return;
				}
				if (!res.ok) throw new Error('Erro ao buscar lotes');
				const data = await res.json();
				setLotes(data);
			} catch (e) {
				setError('Erro ao buscar lotes. Tente novamente.');
			}
			setLoading(false);
		};
		fetchLotes();
		const interval = setInterval(fetchLotes, 4000);
		return () => clearInterval(interval);
	}, [open]);
	if (!open) return null;

	// Status helpers

		const statusInfo = (status: string) => {
			if (status === 'finalizado') return { color: '#22c55e', icon: '✔️', label: 'Finalizado' };
			if (status === 'processando') return { color: '#2563eb', icon: '⏳', label: 'Processando' };
			if (status === 'erro') return { color: '#e11d48', icon: '❌', label: 'Erro' };
			return { color: '#888', icon: '•', label: status };
		};

		// Função para formatar data/hora para o padrão Brasilia
		function formatDate(dateStr?: string) {
			if (!dateStr) return '-';
			try {
				const date = new Date(dateStr);
				return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
			} catch { return '-'; }
		}
		function formatTime(dateStr?: string) {
			if (!dateStr) return '-';
			try {
				const date = new Date(dateStr);
				return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
			} catch { return '-'; }
		}

	return (
		<div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(30,41,59,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
			<div className="modal-content" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px 0 #2563eb33', padding: 32, minWidth: 420, maxWidth: 700, position: 'relative' }}>
				<button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer', fontWeight: 700 }}>×</button>
				<h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 18, color: '#2563eb' }}>Lotes Higienizados</h2>
				{loading ? <Loader /> : error ? (
					<div style={{ color: '#e11d48', fontWeight: 600, margin: '18px 0' }}>{error}</div>
				) : (
					<div style={{ overflowX: 'auto' }}>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: 600 }}>
							<thead>
								<tr style={{ background: '#f1f5f9' }}>
									<th style={{ textAlign: 'left', padding: 6 }}>Nome Arquivo</th>
									<th style={{ textAlign: 'left', padding: 6 }}>Data Iniciado</th>
									<th style={{ textAlign: 'left', padding: 6 }}>Hora Iniciado</th>
									<th style={{ textAlign: 'left', padding: 6 }}>Data Finalizado</th>
									<th style={{ textAlign: 'left', padding: 6 }}>Hora Finalizado</th>
									<th style={{ textAlign: 'left', padding: 6 }}>Status</th>
									<th style={{ textAlign: 'left', padding: 6 }}>Baixar</th>
								</tr>
							</thead>
							<tbody>
								{lotes.length === 0 && (
									<tr><td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 16 }}>Nenhum lote encontrado.</td></tr>
								)}
								{lotes.map((lote, i) => {
									const status = statusInfo(lote.status);
									return (
										<tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
											<td style={{ padding: 6 }}>{lote.nomeArquivo}</td>
											  <td style={{ padding: 6 }}>{formatDate(lote.dataInicio)}</td>
											  <td style={{ padding: 6 }}>{formatTime(lote.dataInicio)}</td>
											  <td style={{ padding: 6 }}>{formatDate(lote.dataFim)}</td>
											  <td style={{ padding: 6 }}>{formatTime(lote.dataFim)}</td>
											<td style={{ padding: 6, color: status.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
												<span title={status.label}>{status.icon}</span> {status.label}
											</td>
											<td style={{ padding: 6 }}>
												{lote.status === 'finalizado' && lote.resultUrl ? (
													<a href={lote.resultUrl} download style={{ color: '#2563eb', fontWeight: 600 }}>Baixar</a>
												) : lote.status === 'processando' ? (
													<span title="Aguardando finalização" style={{ color: '#888', fontStyle: 'italic' }}>Aguardando...</span>
												) : lote.status === 'erro' ? (
													<span title="Erro ao processar lote" style={{ color: '#e11d48', fontWeight: 600 }}>Erro</span>
												) : (
													<span style={{ color: '#888' }}>-</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}

// Ponto de entrada React deve ficar no final do arquivo
const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(
    <Router>
      <App />
    </Router>
  );
}
