import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ArrowLeft, Calendar, User, ChevronRight, Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  image: string;
  category: string;
  url: string;
}

const DEFAULT_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'G1 - O Portal de Notícias da Globo',
    excerpt: 'Acompanhe as últimas notícias do Brasil e do mundo, com vídeos e coberturas em tempo real sobre política, economia e entretenimento.',
    date: '17/03/2026',
    author: 'G1',
    image: 'https://picsum.photos/seed/g1/800/400',
    category: 'Geral',
    url: 'https://g1.globo.com'
  },
  {
    id: '2',
    title: 'UOL - O Melhor Conteúdo',
    excerpt: 'Notícias de hoje, esportes, entretenimento e muito mais. O portal UOL oferece uma cobertura completa e diversificada.',
    date: '17/03/2026',
    author: 'UOL',
    image: 'https://picsum.photos/seed/uol/800/400',
    category: 'Variedades',
    url: 'https://www.uol.com.br'
  },
  {
    id: '3',
    title: 'Terra - Notícias, Esportes e Diversão',
    excerpt: 'Fique por dentro das principais notícias, resultados de esportes, tendências de moda e fofocas dos famosos no portal Terra.',
    date: '17/03/2026',
    author: 'Terra',
    image: 'https://picsum.photos/seed/terra/800/400',
    category: 'Entretenimento',
    url: 'https://www.terra.com.br'
  }
];

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });
  }, []);

  async function fetchNews() {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
      // Fallback to default news if table doesn't exist or error
      setNews(DEFAULT_NEWS);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta notícia?')) {
      try {
        const { error } = await supabase.from('news').delete().eq('id', id);
        if (error) throw error;
        setNews(news.filter(item => item.id !== id));
      } catch (error) {
        console.error('Error deleting news:', error);
      }
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newItem = {
      title: formData.get('title') as string,
      excerpt: formData.get('excerpt') as string,
      author: formData.get('author') as string,
      image: formData.get('image') as string || 'https://picsum.photos/seed/news/800/400',
      category: formData.get('category') as string,
      url: formData.get('url') as string,
    };

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('news')
          .update(newItem)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('news')
          .insert([newItem]);
        if (error) throw error;
      }
      fetchNews();
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving news:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-100 font-display">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-4 sm:px-8 border-b border-white/5 bg-[#0b0e14]/80 backdrop-blur-xl sticky top-0 z-50">
        {/* Left: Branding Logo */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Voltar</span>
          </Link>
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-105 transition-all">
              <Newspaper className="size-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black tracking-tighter uppercase text-white leading-none mb-0.5">NOTÍCIAS</h1>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">Portal GFC</p>
            </div>
          </Link>
        </div>

        {/* Center: Navigation (Desktop) */}
        <nav className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {[
            { label: 'RÁDIOS', to: '/' },
            { label: 'MAPA', to: '/' },
            { label: 'CHAT', to: '/' },
          ].map((item) => (
            <Link 
              key={item.label}
              to={item.to}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-all relative py-2"
            >
              {item.label}
            </Link>
          ))}
          <div className="w-[1px] h-4 bg-white/10 mx-2" />
          <div className="flex items-center gap-8">
            <Link to="/guiche-web" className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${window.location.pathname === '/guiche-web' ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>GUICHÊ WEB</Link>
            <Link to="/podcasts" className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${window.location.pathname === '/podcasts' ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>PODCAST</Link>
            <Link to="/news" className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${window.location.pathname === '/news' ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>NOTICIA</Link>
          </div>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 sm:gap-6">
          {isAdmin && (
            <button 
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="size-4" /> Nova Notícia
            </button>
          )}
          <Link to="/admin" className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
            <User className="size-5" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-12">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Newspaper className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Notícias</h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Fique por dentro das novidades do mundo do rádio</p>
          </div>
        </div>

        <div className="grid gap-12">
          {news.map((item, i) => (
            <motion.article 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group grid md:grid-cols-2 gap-8 items-center bg-white/5 rounded-[40px] overflow-hidden border border-white/5 hover:border-primary/20 transition-all relative"
            >
              {isAdmin && (
                <div className="absolute top-6 right-6 z-10 flex gap-2">
                  <button 
                    onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                    className="p-2 bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/40 transition-all"
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40 transition-all"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
              
              <div className="aspect-video overflow-hidden">
                <img 
                  src={item.image} 
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="p-8 md:pr-12">
                <div className="flex items-center gap-4 mb-4">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                    <Calendar className="size-3" />
                    {item.date}
                  </div>
                </div>
                <h2 className="text-2xl font-black mb-4 group-hover:text-primary transition-colors leading-tight">
                  {item.title}
                </h2>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  {item.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                    <User className="size-3" />
                    {item.author}
                  </div>
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest hover:gap-3 transition-all"
                  >
                    Ler Mais <ChevronRight className="size-4" />
                  </a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </main>

      {/* Admin Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-2xl w-full bg-[#111] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase tracking-tighter">{editingItem ? 'Editar Notícia' : 'Nova Notícia'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X className="size-6" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Título</label>
                    <input name="title" defaultValue={editingItem?.title} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Categoria</label>
                    <input name="category" defaultValue={editingItem?.category} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Resumo</label>
                  <textarea name="excerpt" defaultValue={editingItem?.excerpt} required rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all resize-none" />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Autor</label>
                    <input name="author" defaultValue={editingItem?.author} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">URL da Imagem</label>
                    <input name="image" defaultValue={editingItem?.image} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" placeholder="https://..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">URL da Notícia</label>
                  <input name="url" defaultValue={editingItem?.url} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" placeholder="https://..." />
                </div>
                <button className="w-full py-5 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save className="size-5" /> Salvar Notícia
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-10 border-t border-white/5 text-center">
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 RÁDIO GFC - Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
