import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PODCASTS = [
  {
    id: '1',
    title: 'Café da Manhã',
    author: 'Folha de S.Paulo',
    description: 'O podcast de notícias mais importante do dia, com análises profundas sobre os temas atuais.',
    image: 'https://picsum.photos/seed/podcast1/400',
    category: 'Notícias',
    duration: '25 min'
  },
  {
    id: '2',
    title: 'Flow Podcast',
    author: 'Estúdios Flow',
    description: 'Conversas descontraídas com as personalidades mais influentes do Brasil e do mundo.',
    image: 'https://picsum.photos/seed/podcast2/400',
    category: 'Entretenimento',
    duration: '180 min'
  },
  {
    id: '3',
    title: 'NerdCast',
    author: 'Jovem Nerd',
    description: 'O mundo geek, ciência, história e cultura pop discutidos com muito humor.',
    image: 'https://picsum.photos/seed/podcast3/400',
    category: 'Cultura Pop',
    duration: '90 min'
  },
  {
    id: '4',
    title: 'O Assunto',
    author: 'G1',
    description: 'Natuzza Nery conversa com especialistas para explicar o que é mais relevante no Brasil.',
    image: 'https://picsum.photos/seed/podcast4/400',
    category: 'Política',
    duration: '30 min'
  }
];

export default function Podcasts() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
                <Link to="/" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Heart className="size-5" /> Favoritos
                </Link>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                <Radio className="size-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">RadioWorld</span>
            </Link>
            
            <div className="flex-1 max-w-2xl mx-12 hidden lg:block">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 size-5" />
                <input 
                  className="w-full bg-white/5 border-none rounded-full pl-12 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
                  placeholder="Pesquisar podcasts..." 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4 md:space-x-6">
              <nav className="hidden lg:flex space-x-6">
                <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Compass className="size-5" /> Explorar
                </Link>
                <Link to="/podcasts" className="text-blue-500 font-medium flex items-center gap-2">
                  <Mic2 className="size-5" /> Podcasts
                </Link>
                <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Globe className="size-5" /> Mapa
                </Link>
                <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Heart className="size-5" /> Favoritos
                </Link>
              </nav>
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
                <Menu className="size-6" />
              </button>
              <div className="h-8 w-[1px] bg-white/10 hidden lg:block"></div>
              <Link to="/admin" className="w-9 h-9 rounded-full border border-white/20 overflow-hidden">
                <img 
                  alt="Perfil" 
                  className="w-full h-full object-cover" 
                  src="https://picsum.photos/seed/user/100"
                />
              </Link>
            </div>
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
          {PODCASTS.map((podcast, i) => (
            <motion.div
              key={podcast.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel group cursor-pointer overflow-hidden rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all"
            >
              <div className="relative aspect-square overflow-hidden">
                <img 
                  src={podcast.image} 
                  alt={podcast.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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

      <footer className="py-10 border-t border-white/5 text-center">
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 Radio GeorgeFctech - Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
