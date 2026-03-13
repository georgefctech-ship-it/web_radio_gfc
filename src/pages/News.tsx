import React from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ArrowLeft, Calendar, User, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const NEWS_ITEMS = [
  {
    id: '1',
    title: 'G1 - O Portal de Notícias da Globo',
    excerpt: 'Acompanhe as últimas notícias do Brasil e do mundo, com vídeos e coberturas em tempo real sobre política, economia e entretenimento.',
    date: 'Hoje',
    author: 'G1',
    image: 'https://picsum.photos/seed/g1/800/400',
    category: 'Geral',
    url: 'https://g1.globo.com'
  },
  {
    id: '2',
    title: 'UOL - O Melhor Conteúdo',
    excerpt: 'Notícias de hoje, esportes, entretenimento e muito mais. O portal UOL oferece uma cobertura completa e diversificada.',
    date: 'Hoje',
    author: 'UOL',
    image: 'https://picsum.photos/seed/uol/800/400',
    category: 'Variedades',
    url: 'https://www.uol.com.br'
  },
  {
    id: '3',
    title: 'Terra - Notícias, Esportes e Diversão',
    excerpt: 'Fique por dentro das principais notícias, resultados de esportes, tendências de moda e fofocas dos famosos no portal Terra.',
    date: 'Hoje',
    author: 'Terra',
    image: 'https://picsum.photos/seed/terra/800/400',
    category: 'Entretenimento',
    url: 'https://www.terra.com.br'
  }
];

export default function News() {
  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-100 font-display">
      {/* Header */}
      <header className="h-20 border-b border-white/5 flex items-center px-6 md:px-12 sticky top-0 z-50 bg-[#0b0e14]/80 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <ArrowLeft className="size-5" />
          <span className="text-sm font-bold uppercase tracking-widest">Voltar ao Player</span>
        </Link>
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
          {NEWS_ITEMS.map((item, i) => (
            <motion.article 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group grid md:grid-cols-2 gap-8 items-center bg-white/5 rounded-[40px] overflow-hidden border border-white/5 hover:border-primary/20 transition-all"
            >
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

      <footer className="py-10 border-t border-white/5 text-center">
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 Radio GeorgeFctech - Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
