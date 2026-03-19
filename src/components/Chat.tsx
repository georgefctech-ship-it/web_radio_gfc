import React, { useEffect, useState, useRef } from 'react';
import { socket } from '../lib/socket';
import { Send, User, MessageCircle, X, Settings, Smile, Shield, SendHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: number;
  user: string;
  text: string;
  timestamp: string;
  avatar?: string;
  isSystem?: boolean;
}

interface ChatProps {
  onClose?: () => void;
  isAdmin?: boolean;
  initialUserName?: string;
}

export function Chat({ onClose, isAdmin, initialUserName }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userName, setUserName] = useState(initialUserName || '');
  const [isJoined, setIsJoined] = useState(isAdmin || !!initialUserName);
  const [listeners, setListeners] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on('listeners:count', (count: number) => {
      setListeners(count);
    });

    socket.on('chat:history', (history: Message[]) => {
      setMessages(history);
    });

    socket.on('chat:message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('listeners:count');
      socket.off('chat:history');
      socket.off('chat:message');
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    socket.emit('chat:message', {
      user: userName || 'Anonymous',
      text: inputText,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName || 'Anonymous'}`,
    });
    setInputText('');
  };

  const quickReplies = ["👋 Olá", "❤️ Adoro", "🔥 Top", "🎵 Pedido"];
  const emojis = ["😀", "😂", "😍", "😎", "🤔", "🙌", "👏", "👍", "🔥", "❤️", "✨", "🎉", "🎵", "📻", "🇧🇷", "🇵🇹"];
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  if (!isJoined) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 space-y-6 glass-panel rounded-3xl border border-white/5">
        <div className="size-20 rounded-3xl bg-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
          <MessageCircle className="size-10 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-white">Chat em Direto</h3>
          <p className="text-sm text-gray-400">Junte-se a {(listeners/1000).toFixed(1)}k ouvintes ativos agora mesmo</p>
        </div>
        <div className="w-full max-w-xs space-y-4">
          <input 
            type="text" 
            placeholder="Introduza o seu apelido..." 
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:ring-1 focus:ring-primary outline-none transition-all"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && userName.trim() && setIsJoined(true)}
          />
          <button 
            onClick={() => userName.trim() && setIsJoined(true)}
            disabled={!userName.trim()}
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold hover:bg-primary/80 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            Entrar no Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
      {/* Chat Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Chat em Direto
          </h3>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{(listeners/1000).toFixed(1)}k ouvintes ativos</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-gray-400 hover:text-white p-1.5 transition-colors">
            <Settings className="size-5" />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 transition-colors">
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar"
      >
        {messages.map((msg) => (
          <motion.div 
            initial={{ opacity: 0, x: msg.user === userName ? 20 : -20 }} 
            animate={{ opacity: 1, x: 0 }}
            key={msg.id} 
            className="flex gap-3"
          >
            {msg.isSystem ? (
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30 shrink-0">
                <Shield className="size-4 text-primary" />
              </div>
            ) : (
              <img 
                alt={msg.user} 
                className={`w-8 h-8 rounded-full border ${msg.user === userName ? 'border-white/20' : 'border-primary/30'} shrink-0`}
                src={msg.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user}`}
              />
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold ${msg.isSystem ? 'text-primary' : msg.user === userName ? 'text-white' : 'text-blue-400'}`}>
                  {msg.user === userName ? 'Tu' : msg.user}
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`rounded-2xl rounded-tl-none p-3 text-sm ${
                msg.user === userName 
                  ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                  : msg.isSystem 
                    ? 'bg-primary/5 border border-primary/10 text-primary'
                    : 'bg-white/5 text-gray-200'
              }`}>
                {msg.text}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer Area */}
      <div className="p-5 border-t border-white/5 bg-white/5">
        <div className="flex items-center gap-3 mb-3 overflow-x-auto pb-2 hide-scrollbar">
          {quickReplies.map(reply => (
            <button 
              key={reply}
              onClick={() => { setInputText(reply); }}
              className="bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full text-xs transition-colors whitespace-nowrap text-gray-300"
            >
              {reply}
            </button>
          ))}
        </div>
        
        <form onSubmit={handleSendMessage} className="relative">
          <input 
            type="text" 
            placeholder="Enviar uma mensagem..." 
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-primary pr-24 outline-none transition-all"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <div className="relative">
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-1.5 transition-colors ${showEmojiPicker ? 'text-primary' : 'text-gray-400 hover:text-white'}`}
              >
                <Smile className="size-5" />
              </button>
              
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute bottom-full right-0 mb-2 p-2 glass-panel rounded-2xl border border-white/10 shadow-2xl grid grid-cols-4 gap-1 z-50 min-w-[160px]"
                  >
                    {emojis.map(emoji => (
                      <button 
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setInputText(prev => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-xl p-2 hover:bg-white/10 rounded-xl transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              type="submit"
              className="p-1.5 bg-primary text-white rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-primary/20 active:scale-95"
            >
              <SendHorizontal className="size-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
