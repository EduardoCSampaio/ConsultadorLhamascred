import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import RelatorioModal from './components/RelatorioModal';

const BACKEND_URL = 'https://seu-backend-url.com';
const SUPABASE_URL = 'https://seu-supabase-url.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anon';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Session {
  user: any;
}

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);
  const [cpf, setCpf] = useState('');
  const [resultado, setResultado] = useState<any>(null);
  const [relatorioModalOpen, setRelatorioModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);

  const navigate = useNavigate();

  // Inicializa sessão Supabase
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Função para consultar FGTS
  const handleConsultaFGTS = async () => {
    if (!cpf) return alert('Digite um CPF válido');

    try {
      const res = await fetch(`${BACKEND_URL}/consultaFGTSv8`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      });

      const data = await res.json();

      // Polling para status finalizado
      const intervalId = setInterval(async () => {
        const statusRes = await fetch(`${BACKEND_URL}/consulta-status?cpf=${cpf}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'finalizado') {
          clearInterval(intervalId);
          setResultado(statusData.resultado);
          setRelatorioModalOpen(true);
        }
      }, 3000);
    } catch (err) {
      console.error(err);
      alert('Erro na consulta FGTS');
    }
  };

  // Função para upload de Excel
  const handleUploadExcel = async () => {
    if (!excelFile) return alert('Selecione um arquivo Excel');

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await fetch(`${BACKEND_URL}/consulta-excel`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      alert('Upload realizado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro no upload do Excel');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sistema FGTS</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Digite o CPF"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          className="border p-2 rounded mr-2"
        />
        <button
          onClick={handleConsultaFGTS}
          className="bg-blue-500 text-white p-2 rounded"
        >
          Consultar FGTS
        </button>
      </div>

      <div className="mb-4">
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={handleUploadExcel}
          className="bg-green-500 text-white p-2 rounded ml-2"
        >
          Enviar Excel
        </button>
      </div>

      {resultado && (
        <div className="mt-4 p-4 border rounded bg-gray-100">
          <h2 className="font-bold">Resultado:</h2>
          <pre>{JSON.stringify(resultado, null, 2)}</pre>
        </div>
      )}

      <RelatorioModal
        isOpen={relatorioModalOpen}
        onClose={() => setRelatorioModalOpen(false)}
        data={resultado}
      />
    </div>
  );
};

// Wrap com Router para uso do useNavigate
const AppWrapper: React.FC = () => (
  <Router>
    <Routes>
      <Route path="/*" element={<App />} />
    </Routes>
  </Router>
);

export default AppWrapper;
