import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ticket, ExternalLink, Music, Star, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

const EVENT_SITES = [
  {
    name: 'Guichê Web',
    url: 'https://www.guicheweb.com.br/',
    description: 'Venda de ingressos para os melhores eventos, shows, teatros e muito mais.',
    category: 'Ingressos',
    image: 'https://image.thum.io/get/width/800/crop/600/https://www.guicheweb.com.br/'
  },
  {
    name: 'UZNA',
    url: 'https://www.instagram.com/uzna.oficial/channel/',
    description: 'A maior arena de eventos da região de Sorocaba. Confira a programação completa no Instagram oficial.',
    category: 'Arena de Eventos',
    image: 'https://picsum.photos/seed/uzna-arena/800/400' // Instagram blocks screenshots, using a themed fallback
  },
  {
    name: 'Sympla',
    url: 'https://www.sympla.com.br/',
    description: 'A maior plataforma de eventos do Brasil. Encontre shows, festas, cursos e eventos online.',
    category: 'Eventos',
    image: 'https://image.thum.io/get/width/800/crop/600/https://www.sympla.com.br/'
  },
  {
    name: 'Eventim',
    url: 'https://www.eventim.com.br/',
    description: 'Ingressos para os maiores shows internacionais e eventos culturais no Brasil.',
    category: 'Shows Internacionais',
    image: 'https://image.thum.io/get/width/800/crop/600/https://www.eventim.com.br/'
  },
  {
    name: 'Uhuu',
    url: 'https://www.uhuu.com/',
    description: 'Sua plataforma de entretenimento. Ingressos para shows, teatro e experiências únicas.',
    category: 'Entretenimento',
    image: 'https://image.thum.io/get/width/800/crop/600/https://www.uhuu.com/'
  },
  {
    name: 'Ticket360',
    url: 'https://www.ticket360.com.br/',
    description: 'Ingressos para os melhores shows e eventos de São Paulo e de todo o Brasil.',
    category: 'Shows',
    image: 'https://image.thum.io/get/width/800/crop/600/https://www.ticket360.com.br/'
  }
];

const FEATURED_EVENTS = [
  {
    title: 'Show na UZNA Arena',
    location: 'Sorocaba, SP',
    image: 'https://picsum.photos/seed/uzna-concert/400/500',
    link: 'https://www.instagram.com/uzna.oficial/channel/',
    provider: 'UZNA'
  },
  {
    title: 'Grandes Shows Interior',
    location: 'Região de Sorocaba, SP',
    image: 'https://picsum.photos/seed/interior-show/400/500',
    link: 'https://www.guicheweb.com.br/',
    provider: 'Guichê Web'
  },
  {
    title: 'Eventos Culturais SP',
    location: 'Interior de São Paulo',
    image: 'https://picsum.photos/seed/sp-culture/400/500',
    link: 'https://www.eventim.com.br/',
    provider: 'Eventim'
  }
];

export default function GuicheWeb() {
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
              <Ticket className="size-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black tracking-tighter uppercase text-white leading-none mb-0.5">GUICHÊ WEB</h1>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">Ingressos Online</p>
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
          <Link to="/admin" className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
            <Star className="size-5" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-12">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Ticket className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Guichê Web</h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Encontre os melhores eventos musicais e garanta seu ingresso</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {EVENT_SITES.map((site, i) => (
            <motion.div 
              key={site.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group bg-white/5 rounded-[32px] overflow-hidden border border-white/5 hover:border-primary/20 transition-all flex flex-col"
            >
              <div className="aspect-video overflow-hidden relative">
                <img 
                  src={site.image} 
                  alt={site.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${site.name}/800/400`;
                  }}
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {site.category}
                  </span>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h2 className="text-2xl font-black mb-3 group-hover:text-primary transition-colors">
                  {site.name}
                </h2>
                <p className="text-gray-400 mb-6 text-sm leading-relaxed flex-1">
                  {site.description}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <Music className="size-3" /> Shows
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <Star className="size-3" /> VIP
                    </div>
                  </div>
                  <a 
                    href={site.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all"
                  >
                    Acessar Site <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Featured Events Section */}
        <section className="mt-24 p-12 bg-white/5 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -z-10" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-8 uppercase tracking-tighter">Eventos em Destaque</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {FEATURED_EVENTS.map((event, i) => (
                <a 
                  key={i} 
                  href={event.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group space-y-3 block"
                >
                  <div className="aspect-[4/5] rounded-2xl overflow-hidden relative">
                    <img 
                      src={event.image} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      alt={event.title} 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 bg-primary text-white text-[8px] font-black uppercase tracking-widest rounded-md">
                        {event.provider}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-bold text-sm group-hover:text-primary transition-colors">{event.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    <MapPin className="size-3" /> {event.location}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 border-t border-white/5 text-center">
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 RÁDIO GFC - Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
