import React, { useEffect, useState, useMemo, FormEvent, Component } from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  Settings, 
  Users, 
  History, 
  Heart, 
  Plus, 
  Search, 
  Bell, 
  LogOut, 
  MoreVertical, 
  TrendingUp, 
  Globe, 
  Shield, 
  Edit2, 
  Trash2, 
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Activity
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Mock data for charts
const AUDIENCE_DATA = [
  { name: '00:00', value: 400 },
  { name: '04:00', value: 300 },
  { name: '08:00', value: 900 },
  { name: '12:00', value: 1200 },
  { name: '16:00', value: 1500 },
  { name: '20:00', value: 1100 },
  { name: '23:59', value: 600 },
];

const GENRE_DATA = [
  { name: 'Pop', value: 400 },
  { name: 'Rock', value: 300 },
  { name: 'Jazz', value: 300 },
  { name: 'Sertanejo', value: 200 },
];

const COLORS = ['#FF4D15', '#FF8C00', '#FFD700', '#FFA500'];

export default function AdminDashboard() {
  const [stats, setStats] = useState({ stations: 0, favorites: 0, history: 0, online: 0 });
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState({ 
    name: 'Radio GeorgeFctech', 
    logo: 'https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png',
    adminName: 'George Fctech',
    adminPhoto: '',
    maintenanceMode: false,
    debugLogs: false,
    pushNotifications: false
  });
  const [customStations, setCustomStations] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<any>(null);
  const [stationForm, setStationForm] = useState({ name: '', url: '', genre: '', favicon: '' });
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          navigate('/admin');
          return;
        }
      } catch (e) {
        console.error("Auth session check failed:", e);
        navigate('/admin');
        return;
      }
      
      try {
        // Fetch stats
        let favCount = 0;
        try {
          const { count } = await supabase.from('favorites').select('*', { count: 'exact', head: true });
          favCount = count || 0;
        } catch (e) {
          console.warn("Could not fetch favorites count:", e);
        }

        let histCount = 0;
        try {
          const { count } = await supabase.from('listening_history').select('*', { count: 'exact', head: true });
          histCount = count || 0;
        } catch (e) {
          console.warn("Could not fetch history count:", e);
        }
        
        // Fetch custom stations
        const { data: stations } = await supabase.from('stations').select('*');
        if (stations) setCustomStations(stations);

        // Fetch recent history
        try {
          const { data: hist } = await supabase.from('listening_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
          if (hist) setRecentHistory(hist);
        } catch (e) {
          console.warn("Could not fetch recent history:", e);
        }

        setStats({
          stations: (stations?.length || 0),
          favorites: favCount,
          history: histCount,
          online: Math.floor(Math.random() * 100) + 50 // Mock online listeners
        });

        // Fetch branding from Supabase
        try {
          const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 'global')
            .maybeSingle();

          if (settings) {
            setBranding({
              name: settings.name || 'Radio GeorgeFctech',
              logo: settings.logo || 'https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png',
              adminName: settings.admin_name || 'George Fctech',
              adminPhoto: settings.admin_photo || '',
              maintenanceMode: settings.maintenance_mode || false,
              debugLogs: settings.debug_logs || false,
              pushNotifications: settings.push_notifications || false
            });
          }
        } catch (e) {
          console.warn("Could not fetch settings:", e);
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleSaveStation = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: stationForm.name,
        stream_url: stationForm.url,
        genre: stationForm.genre.split(',').map(g => g.trim()),
        cover_url: stationForm.favicon,
        updated_at: new Date().toISOString()
      };

      if (editingStation) {
        const { error } = await supabase.from('stations').update(payload).eq('id', editingStation.id);
        if (error) throw error;
        showNotification('success', 'Estação atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('stations').insert([payload]);
        if (error) throw error;
        showNotification('success', 'Estação criada com sucesso!');
      }

      // Refresh stations
      const { data: stations } = await supabase.from('stations').select('*');
      if (stations) setCustomStations(stations);
      
      setIsModalOpen(false);
      setEditingStation(null);
      setStationForm({ name: '', url: '', genre: '', favicon: '' });
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStation = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta estação?')) return;
    try {
      const { error } = await supabase.from('stations').delete().eq('id', id);
      if (error) throw error;
      setCustomStations(prev => prev.filter(s => s.id !== id));
      showNotification('success', 'Estação excluída!');
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const openEditModal = (station: any) => {
    setEditingStation(station);
    setStationForm({
      name: station.name,
      url: station.stream_url || station.url,
      genre: Array.isArray(station.genre) ? station.genre.join(', ') : (station.genre || ''),
      favicon: station.cover_url || station.logo_url || ''
    });
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0F0F0F] flex flex-col items-center justify-center gap-4">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white font-bold uppercase tracking-widest text-xs">Carregando Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0F0F0F] text-white font-display overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-[#1A1A1A] border-r border-white/5 flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="size-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
              {branding.logo ? (
                <img 
                  src={branding.logo} 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png";
                  }}
                />
              ) : (
                <Radio className="size-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none truncate max-w-[150px]">{branding.name || 'Admin'}</h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Studio Dashboard</p>
            </div>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'stations', icon: Radio, label: 'Estações' },
              { id: 'users', icon: Users, label: 'Usuários' },
              { id: 'history', icon: History, label: 'Histórico' },
              { id: 'settings', icon: Settings, label: 'Configurações' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm ${
                  activeMenu === item.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-gray-500 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className="size-5" />
                {item.label}
              </button>
            ))}
            
            <Link 
              to="/studio" 
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm text-primary hover:bg-primary/10"
            >
              <Activity className="size-5" />
              Estúdio ao Vivo
            </Link>
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all font-bold text-sm"
          >
            <LogOut className="size-5" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Top Bar */}
        <header className="h-24 border-b border-white/5 px-10 flex items-center justify-between bg-[#0F0F0F]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-500 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar no sistema..." 
                className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 outline-none focus:border-primary/50 transition-all text-sm w-80"
              />
            </div>
            <button className="p-3 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all relative border border-white/10">
              <Bell className="size-5" />
              <span className="absolute top-2.5 right-2.5 size-2 bg-[#FF4D15] rounded-full border-2 border-[#0F0F0F]"></span>
            </button>
          </div>

          <div className="flex items-center gap-4 bg-white/5 p-1.5 pl-4 rounded-2xl border border-white/10">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-white leading-tight">{branding.adminName}</p>
              <p className="text-[9px] font-black text-primary uppercase tracking-widest">Administrador</p>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden">
              <img 
                src={branding.adminPhoto || "https://picsum.photos/seed/admin/100"} 
                alt="Admin" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://picsum.photos/seed/admin/100";
                }}
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-10 space-y-10">
          {activeMenu === 'dashboard' && (
            <>
              {/* Quick Actions / Studio Access */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/10 border border-primary/20 rounded-[40px] p-8 flex flex-col md:flex-row items-center justify-between gap-6"
              >
                <div className="flex items-center gap-6">
                  <div className="size-20 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/20">
                    <Activity className="size-10 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Estúdio ao Vivo</h2>
                    <p className="text-gray-400 text-sm font-medium">Inicie sua transmissão agora e fale com seus ouvintes em tempo real.</p>
                  </div>
                </div>
                <Link 
                  to="/studio" 
                  className="px-10 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
                >
                  Entrar no Estúdio
                </Link>
              </motion.div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total de Rádios', value: stats.stations, icon: Radio, color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'Ouvintes Online', value: stats.online, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { label: 'Favoritos', value: stats.favorites, icon: Heart, color: 'text-red-500', bg: 'bg-red-500/10' },
                  { label: 'Histórico', value: stats.history, icon: History, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                ].map((stat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className="bg-[#1A1A1A] p-8 rounded-[32px] border border-white/5 flex items-center gap-6"
                  >
                    <div className={`size-16 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="size-8" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className="text-3xl font-black">{stat.value.toLocaleString()}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[#1A1A1A] p-8 rounded-[40px] border border-white/5">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Estatísticas de Audiência</h3>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Últimas 24 horas</p>
                    </div>
                    <button className="p-2 text-gray-500 hover:text-white"><MoreVertical className="size-5" /></button>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={AUDIENCE_DATA}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF4D15" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#FF4D15" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#ffffff20" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#ffffff20" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #ffffff10', borderRadius: '12px' }}
                          itemStyle={{ color: '#FF4D15' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#FF4D15" 
                          strokeWidth={4}
                          fillOpacity={1} 
                          fill="url(#colorValue)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] p-8 rounded-[40px] border border-white/5">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-8 text-center">Distribuição por Gênero</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={GENRE_DATA}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {GENRE_DATA.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-4">
                    {GENRE_DATA.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                          <span className="text-gray-400 font-bold uppercase">{item.name}</span>
                        </div>
                        <span className="font-black">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity Table */}
              <div className="bg-[#1A1A1A] rounded-[40px] border border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-xl font-black uppercase tracking-tight">Atividade Recente</h3>
                  <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Ver Tudo</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                        <th className="px-8 py-6">Estação</th>
                        <th className="px-8 py-6">Gênero</th>
                        <th className="px-8 py-6">Data/Hora</th>
                        <th className="px-8 py-6">Status</th>
                        <th className="px-8 py-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentHistory.map((item, i) => (
                        <tr key={i} className="group hover:bg-white/5 transition-all">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="size-10 rounded-xl bg-white/5 overflow-hidden">
                                <img 
                                  src={item.favicon || `https://picsum.photos/seed/${item.name}/100`} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://picsum.photos/seed/radio/100`;
                                  }}
                                />
                              </div>
                              <span className="font-bold text-sm">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-xs text-gray-500 font-bold uppercase">{item.genre}</span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Online</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button className="p-2 text-gray-500 hover:text-white transition-all"><MoreVertical className="size-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeMenu === 'stations' && (
            <div className="space-y-12">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-6xl font-black tracking-tighter uppercase">Estações</h2>
                  <p className="text-gray-500 text-sm font-bold uppercase tracking-[0.3em] mt-2">Gerencie as rádios do sistema</p>
                </div>
                <button 
                  onClick={() => { setEditingStation(null); setStationForm({ name: '', url: '', genre: '', favicon: '' }); setIsModalOpen(true); }}
                  className="bg-primary text-white px-10 py-5 rounded-[24px] font-black uppercase tracking-widest text-xs flex items-center gap-4 hover:scale-105 transition-all shadow-2xl shadow-primary/40"
                >
                  <Plus className="size-6" />
                  Adicionar Rádio
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-10">
                {customStations.map((station) => (
                  <div key={station.id} className="bg-[#141414] p-8 rounded-[48px] border border-white/5 group hover:border-primary/30 transition-all shadow-2xl">
                    <div className="relative aspect-square rounded-[32px] overflow-hidden mb-8 shadow-2xl">
                      <img 
                        src={station.cover_url || station.logo_url || `https://picsum.photos/seed/${station.name}/400`} 
                        alt={station.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${station.name}/400`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                        <button 
                          onClick={() => openEditModal(station)}
                          className="size-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-xl"
                        >
                          <Edit2 className="size-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStation(station.id)}
                          className="size-12 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-xl"
                        >
                          <Trash2 className="size-5" />
                        </button>
                      </div>
                    </div>
                    <div className="px-2">
                      <h3 className="font-black text-lg uppercase tracking-tight mb-1 truncate">{station.name}</h3>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] truncate">
                        {Array.isArray(station.genre) ? station.genre[0] : (station.genre || 'Rádio')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMenu === 'users' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Usuários</h2>
              <div className="bg-[#1A1A1A] p-10 rounded-[40px] border border-white/5 text-center">
                <Users className="size-16 text-gray-700 mx-auto mb-6" />
                <p className="text-gray-500 font-bold uppercase tracking-widest">Gerenciamento de usuários em breve</p>
              </div>
            </div>
          )}

          {activeMenu === 'history' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Histórico Completo</h2>
              <div className="bg-[#1A1A1A] rounded-[40px] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                        <th className="px-8 py-6">Estação</th>
                        <th className="px-8 py-6">Gênero</th>
                        <th className="px-8 py-6">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentHistory.map((item, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-all">
                          <td className="px-8 py-6 font-bold text-sm">{item.name}</td>
                          <td className="px-8 py-6 text-xs text-gray-500 uppercase font-bold">{item.genre}</td>
                          <td className="px-8 py-6 text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'settings' && (
            <div className="max-w-5xl space-y-12 relative">
              <div className="absolute -top-20 left-0 pointer-events-none select-none">
                <h2 className="text-[120px] font-black text-white/[0.03] uppercase tracking-tighter leading-none">Configurações</h2>
              </div>

              <div className="flex items-center justify-between relative z-10">
                <h2 className="text-3xl font-black tracking-tighter uppercase">Configurações</h2>
              </div>
              
              <div className="bg-[#1A1A1A] p-12 rounded-[48px] border border-white/5 space-y-12 shadow-2xl relative z-10">
                <div className="space-y-8">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-primary">Branding da Rádio</h3>
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome da Rádio</label>
                      <input 
                        type="text" 
                        value={branding.name}
                        onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-[20px] px-8 py-5 outline-none focus:border-primary/50 transition-all font-bold text-sm" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Logo</label>
                      <div className="flex gap-6">
                        <input 
                          type="text" 
                          value={branding.logo}
                          onChange={(e) => setBranding({ ...branding, logo: e.target.value })}
                          className="flex-1 bg-white/[0.03] border border-white/10 rounded-[20px] px-8 py-5 outline-none focus:border-primary/50 transition-all font-bold text-sm" 
                        />
                        <div className="size-16 rounded-2xl border border-white/10 overflow-hidden bg-white/[0.03] flex-shrink-0 shadow-lg">
                          <img 
                            src={branding.logo || "https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png"} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png";
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const payload = {
                          name: branding.name,
                          logo: branding.logo,
                          admin_name: branding.adminName,
                          admin_photo: branding.adminPhoto,
                          maintenance_mode: branding.maintenanceMode,
                          debug_logs: branding.debugLogs,
                          push_notifications: branding.pushNotifications,
                          updated_at: new Date().toISOString()
                        };

                        const { error } = await supabase.from('settings').upsert({ id: 'global', ...payload });
                        if (error) {
                          console.error("Supabase settings save error:", error);
                          if (error.code === '42P01') {
                            throw new Error('A tabela "settings" não existe no Supabase. Por favor, crie-a no SQL Editor.');
                          }
                          throw error;
                        }
                        
                        showNotification('success', 'Configurações salvas com sucesso!');
                      } catch (err: any) {
                        showNotification('error', 'Erro ao salvar configurações: ' + err.message);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="bg-primary text-white px-12 py-5 rounded-[24px] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-primary/30 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>

                <div className="h-[1px] bg-white/5"></div>

                <div className="space-y-8">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-primary">Perfil do Administrador</h3>
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome do Administrador</label>
                      <input 
                        type="text" 
                        value={branding.adminName}
                        onChange={(e) => setBranding({ ...branding, adminName: e.target.value })}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-[20px] px-8 py-5 outline-none focus:border-primary/50 transition-all font-bold text-sm" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL da Foto do Administrador</label>
                      <div className="flex gap-6">
                        <input 
                          type="text" 
                          value={branding.adminPhoto}
                          onChange={(e) => setBranding({ ...branding, adminPhoto: e.target.value })}
                          className="flex-1 bg-white/[0.03] border border-white/10 rounded-[20px] px-8 py-5 outline-none focus:border-primary/50 transition-all font-bold text-sm" 
                        />
                        <div className="size-16 rounded-2xl border border-white/10 overflow-hidden bg-white/[0.03] flex-shrink-0 shadow-lg">
                          <img 
                            src={branding.adminPhoto || "https://picsum.photos/seed/admin/100"} 
                            alt="Admin Preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://picsum.photos/seed/admin/100";
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-[1px] bg-white/5"></div>

                <div className="space-y-8">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-500">Preferências do Sistema</h3>
                  <div className="space-y-6">
                    {[
                      { id: 'maintenanceMode', label: 'Modo de Manutenção', desc: 'Desativa o acesso público ao player temporariamente.' },
                      { id: 'debugLogs', label: 'Logs de Depuração', desc: 'Habilita logs detalhados no console para desenvolvedores.' },
                      { id: 'pushNotifications', label: 'Notificações Push', desc: 'Envia alertas para usuários sobre novas rádios.' },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-8 bg-white/[0.02] rounded-[32px] border border-white/5 hover:bg-white/[0.04] transition-all group">
                        <div>
                          <p className="font-black text-sm uppercase tracking-tight mb-1">{item.label}</p>
                          <p className="text-[11px] text-gray-500 font-bold">{item.desc}</p>
                        </div>
                        <div 
                          onClick={() => setBranding({ ...branding, [item.id]: !branding[item.id as keyof typeof branding] })}
                          className={`w-14 h-7 rounded-full relative cursor-pointer transition-all ${branding[item.id as keyof typeof branding] ? 'bg-primary' : 'bg-white/10'}`}
                        >
                          <motion.div 
                            animate={{ x: branding[item.id as keyof typeof branding] ? 28 : 0 }}
                            className="absolute left-1.5 top-1.5 size-4 bg-white rounded-full shadow-lg"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <footer className="mt-auto py-10 border-t border-white/5 text-center bg-bg-dark">
            <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 {branding.name} - Todos os direitos reservados</p>
          </footer>
        </div>
      </main>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-10 right-10 z-[500] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
              notification.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-red-500 text-white border-red-400'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
            <span className="font-bold text-sm uppercase tracking-widest">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Station Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
          >
            <div className="max-w-2xl w-full bg-[#1A1A1A] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase">{editingStation ? 'Editar Rádio' : 'Nova Rádio'}</h2>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Preencha as informações da estação</p>
                </div>
                <button onClick={() => { setIsModalOpen(false); setEditingStation(null); }} className="size-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStation} className="p-10 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome da Estação</label>
                    <input 
                      required
                      value={stationForm.name}
                      onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gêneros (separados por vírgula)</label>
                    <input 
                      value={stationForm.genre}
                      onChange={(e) => setStationForm({ ...stationForm, genre: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">URL do Stream</label>
                  <input 
                    required
                    value={stationForm.url}
                    onChange={(e) => setStationForm({ ...stationForm, url: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">URL da Capa/Logo</label>
                  <input 
                    value={stationForm.favicon}
                    onChange={(e) => setStationForm({ ...stationForm, favicon: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" 
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-white/5 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={saving}
                    className="flex-[2] py-5 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center justify-center gap-3"
                  >
                    {saving ? (
                      <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Save className="size-5" />
                    )}
                    {editingStation ? 'Salvar Alterações' : 'Criar Estação'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
  );
}
