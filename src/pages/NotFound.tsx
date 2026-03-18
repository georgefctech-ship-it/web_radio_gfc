import React from 'react';
import { Link } from 'react-router-dom';
import { Radio, Home } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="size-24 bg-primary/10 rounded-[40px] flex items-center justify-center border border-primary/20">
          <Radio className="size-12 text-primary animate-pulse" />
        </div>
        <div className="absolute -inset-4 bg-primary/5 blur-2xl rounded-full" />
      </div>
      
      <h1 className="text-6xl font-black text-white mb-4 tracking-tighter">404</h1>
      <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Página Não Encontrada</h2>
      <p className="text-gray-500 max-w-md mb-8">
        Ops! Parece que essa estação saiu do ar ou o link está incorreto. 
        Volte para a programação principal.
      </p>
      
      <Link 
        to="/" 
        className="flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
      >
        <Home className="size-5" />
        Voltar ao Início
      </Link>
    </div>
  );
};

export default NotFound;
