import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Compass, 
  Heart, 
  Mic2, 
  Globe, 
  Search, 
  Play, 
  Pause, 
  Clock, 
  Calendar,
  ChevronLeft,
  MoreVertical,
  Radio,
  Menu,
  X,
  Newspaper,
  Edit2,
  Instagram,
  Twitter,
  Youtube,
  Facebook,
  Linkedin,
  Music2,
  AtSign,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

export default function Podcasts() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPodcast, setSelectedPodcast] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });
    fetchPodcasts();
  }, []);

  async function fetchPodcasts() {
    try {
      const { data, error } = await supabase
        .from('podcasts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPodcasts(data || []);
    } catch (error) {
      console.error('Error fetching podcasts:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPodcasts = podcasts.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#0b0e14] text-gray-100 font-display min-h-screen flex flex-col overflow-x-hidden">
      {/* Sidebar Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[100] bg-black/60 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 z-[110] w-72 bg-[#080B11] p-8 flex flex-col lg:hidden"
            >
              <div className="flex justify-between items-center mb-10">
                <span className="text-xl font-black text-white">MENU</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="size-6" />
                </button>
              </div>
              <nav className="space-y-4">
                <Link to="/" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Compass className="size-5" /> Explorar
                </Link>
                <Link to="/" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Globe className="size-5" /> Mapa
                </Link>
                <Link to="/podcasts" className="flex items-center gap-3 text-blue-500 py-2">
                  <Mic2 className="size-5" /> Podcasts
                </Link>
                <Link to="/news" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Newspaper className="size-5" /> Notícias
                </Link>
                <Link to="/guiche-web" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Ticket className="size-5" /> Guichê Web
                </Link>
                <Link to="/" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Heart className="size-5" /> Favoritos
                </Link>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-4 sm:px-8 border-b border-white/5 bg-[#0b0e14]/80 backdrop-blur-xl sticky top-0 z-50">
        {/* Left: Branding Logo */}
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-all active:scale-95">
            <Menu className="size-5" />
          </button>
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20 group-hover:scale-105 transition-all">
              <Radio className="size-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black tracking-tighter uppercase text-white leading-none mb-0.5">RÁDIO GFC</h1>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">Rádio Digital</p>
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

        {/* Right: Search & Actions */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="relative group hidden sm:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
            <input 
              type="text"
              placeholder="Pesquisar podcasts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full py-2.5 pl-11 pr-6 outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-[10px] font-medium w-48 md:w-64 focus:w-80"
            />
          </div>

          <div className="flex items-center gap-2">
            <Link to="/admin" className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
              <AtSign className="size-5" />
            </Link>
            {isAdmin && (
              <Link to="/admin/dashboard" className="bg-primary/20 text-primary px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all flex items-center gap-2">
                <Edit2 className="size-3" /> Dashboard
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-[300px] md:h-[400px] overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://picsum.photos/seed/podcast-hero/1920/600" 
            className="w-full h-full object-cover opacity-30"
            alt="Podcast Hero"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/60 to-transparent"></div>
        </div>
        <div className="relative max-w-[1600px] mx-auto h-full px-4 md:px-6 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-blue-500 font-bold uppercase tracking-widest text-sm mb-4 block">Destaques da Semana</span>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 max-w-3xl leading-tight">
              Os Melhores Podcasts em <span className="text-blue-500">Português</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mb-8">
              Descubra novas histórias, aprenda algo novo ou simplesmente relaxe com a nossa seleção exclusiva de podcasts.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto w-full px-4 md:px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Mic2 className="text-blue-500 size-7" /> Podcasts Populares
          </h2>
          <div className="flex gap-2">
            {['Tudo', 'Notícias', 'Cultura', 'Tecnologia'].map((cat) => (
              <button key={cat} className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="glass-panel h-[400px] animate-pulse rounded-3xl bg-white/5" />
            ))
          ) : filteredPodcasts.map((podcast, i) => (
            <motion.div
              key={podcast.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedPodcast(podcast)}
              className="glass-panel group cursor-pointer overflow-hidden rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all"
            >
              <div className="relative aspect-square overflow-hidden">
                <img 
                  src={podcast.image || `https://picsum.photos/seed/${podcast.title}/400`} 
                  alt={podcast.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                    <Play className="size-8 text-white fill-current ml-1" />
                  </button>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {podcast.category}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">{podcast.title}</h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-1">{podcast.author}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {podcast.duration}
                  </span>
                  <button className="text-gray-500 hover:text-white">
                    <MoreVertical className="size-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Podcast Player Modal */}
        <AnimatePresence>
          {selectedPodcast && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-8"
            >
              <div className="max-w-5xl w-full bg-[#0d1117] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                <div className="w-full md:w-1/2 aspect-square md:aspect-auto relative overflow-hidden bg-black flex items-center justify-center">
                  {selectedPodcast.media_url?.match(/\.(mp4|webm|ogg)$/i) || selectedPodcast.media_url?.includes('youtube.com') || selectedPodcast.media_url?.includes('vimeo.com') ? (
                    <video 
                      src={selectedPodcast.media_url} 
                      controls 
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <img 
                        src={selectedPodcast.image || `https://picsum.photos/seed/${selectedPodcast.title}/800`} 
                        alt={selectedPodcast.title} 
                        className="w-full h-full object-cover opacity-50 blur-xl"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
                        <img 
                          src={selectedPodcast.image || `https://picsum.photos/seed/${selectedPodcast.title}/400`} 
                          alt={selectedPodcast.title} 
                          className="w-64 h-64 object-cover rounded-3xl shadow-2xl mb-8"
                        />
                        <audio 
                          src={selectedPodcast.media_url} 
                          controls 
                          autoPlay
                          className="w-full max-w-md"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 p-8 md:p-12 flex flex-col overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded-full uppercase tracking-widest mb-4 inline-block">
                        {selectedPodcast.category}
                      </span>
                      <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none mb-2">{selectedPodcast.title}</h2>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{selectedPodcast.author}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedPodcast(null)}
                      className="size-12 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
                    >
                      <X className="size-6" />
                    </button>
                  </div>

                  <div className="flex items-center gap-6 mb-10 text-gray-500 text-xs font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Clock className="size-4 text-blue-500" /> {selectedPodcast.duration}</span>
                    <span className="flex items-center gap-2"><Calendar className="size-4 text-blue-500" /> {new Date(selectedPodcast.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="prose prose-invert max-w-none mb-12">
                    <p className="text-gray-400 leading-relaxed text-lg">
                      {selectedPodcast.description}
                    </p>
                  </div>

                  <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-4">
                      <button className="size-12 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                        <Heart className="size-5" />
                      </button>
                      <button className="size-12 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                        <Search className="size-5" />
                      </button>
                    </div>
                    <button className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-blue-900/20">
                      Compartilhar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories Section */}
        <section className="mt-24">
          <h2 className="text-2xl font-bold text-white mb-10">Explorar Categorias</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Notícias', icon: 'newspaper', color: 'bg-blue-500' },
              { name: 'Tecnologia', icon: 'terminal', color: 'bg-purple-500' },
              { name: 'Ciência', icon: 'flask', color: 'bg-emerald-500' },
              { name: 'Negócios', icon: 'briefcase', color: 'bg-amber-500' },
              { name: 'Educação', icon: 'graduation-cap', color: 'bg-rose-500' },
              { name: 'Saúde', icon: 'heart-pulse', color: 'bg-cyan-500' }
            ].map((cat, i) => (
              <button key={i} className="glass-panel p-6 rounded-3xl flex flex-col items-center gap-4 hover:bg-white/5 transition-all group">
                <div className={`w-12 h-12 ${cat.color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                  <Radio className="size-6" />
                </div>
                <span className="font-bold text-sm text-gray-300">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Footer Player Placeholder */}
      <div className="h-24"></div>

      <footer className="py-10 border-t border-white/5 text-center space-y-6">
        <div className="flex items-center justify-center gap-6">
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Instagram className="size-5" /></a>
          <a href="https://spotify.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Music2 className="size-5" /></a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Twitter className="size-5" /></a>
          <a href="https://threads.net" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><AtSign className="size-5" /></a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Youtube className="size-5" /></a>
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Facebook className="size-5" /></a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Linkedin className="size-5" /></a>
        </div>
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 RÁDIO GFC - Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
