import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft, MessageSquare, Mail, Phone, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const FAQS = [
  {
    question: 'Como posso adicionar minha rádio favorita?',
    answer: 'Você pode adicionar rádios favoritas clicando no ícone de coração no player. Se a rádio não estiver na lista, você pode sugerir uma nova estação através do nosso formulário de contato.'
  },
  {
    question: 'O player não está carregando o áudio, o que fazer?',
    answer: 'Verifique sua conexão com a internet. Algumas estações podem estar temporariamente fora do ar. Tente recarregar a página ou selecionar outra estação.'
  },
  {
    question: 'Existe um aplicativo para celular?',
    answer: 'Atualmente, nosso player é totalmente responsivo e funciona perfeitamente em navegadores móveis. Estamos trabalhando em versões nativas para iOS e Android.'
  },
  {
    question: 'Como posso me tornar um administrador?',
    answer: 'O acesso administrativo é restrito à nossa equipe interna. Se você é um parceiro ou proprietário de rádio, entre em contato conosco para discutir parcerias.'
  }
];

export default function Support() {
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
            <HelpCircle className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Suporte</h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Como podemos ajudar você hoje?</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            { icon: MessageSquare, title: 'Chat ao Vivo', desc: 'Fale com nossa equipe em tempo real.', color: 'bg-blue-500/10 text-blue-500' },
            { icon: Mail, title: 'E-mail', desc: 'Envie sua dúvida para suporte@radiogeorge.com', color: 'bg-primary/10 text-primary' },
            { icon: Phone, title: 'Telefone', desc: 'Atendimento de segunda a sexta, das 9h às 18h.', color: 'bg-emerald-500/10 text-emerald-500' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-white/5 rounded-[40px] border border-white/5 hover:border-white/10 transition-all text-center group"
            >
              <div className={`size-16 mx-auto rounded-3xl flex items-center justify-center mb-6 ${item.color} group-hover:scale-110 transition-transform`}>
                <item.icon className="size-8" />
              </div>
              <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="space-y-12">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Perguntas Frequentes</h2>
          <div className="grid gap-4">
            {FAQS.map((faq, i) => (
              <motion.details 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group bg-white/5 rounded-3xl border border-white/5 overflow-hidden open:bg-white/10 transition-all"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="font-bold text-gray-200 group-open:text-primary transition-colors">{faq.question}</span>
                  <ChevronRight className="size-5 text-gray-500 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 text-sm leading-relaxed">
                  {faq.answer}
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-10 border-t border-white/5 text-center">
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 Radio GeorgeFctech - Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
