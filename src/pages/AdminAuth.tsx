import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AdminAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async () => {
    if (!email || !password) {
      alert('Por favor, preencha todos os campos');
      return;
    }
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else if (data.user) {
      navigate('/admin/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background-dark p-6">
      <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-primary/30 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Globe className="size-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100">Painel Administrativo</h2>
          <p className="text-slate-400 text-sm">
            RÁDIO GFC - Gestão de Estúdio
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full bg-primary/5 border border-primary/20 rounded-xl p-3 text-slate-100 focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-primary/5 border border-primary/20 rounded-xl p-3 text-slate-100 focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          
          <button 
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Entrar'}
          </button>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full py-2 text-slate-400 hover:text-white text-sm"
          >
            Voltar para a Rádio
          </button>
        </div>
      </div>
      <footer className="absolute bottom-0 w-full py-10 text-center">
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 RÁDIO GFC - Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
