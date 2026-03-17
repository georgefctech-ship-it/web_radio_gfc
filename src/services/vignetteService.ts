import { supabase } from '../lib/supabase';

export interface Vignette {
  id: string;
  name: string;
  url: string;
  created_at?: string;
}

const DEFAULT_VIGNETTES: Vignette[] = [
  { id: 'test-1', name: 'Vinheta de Teste (George)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '1', name: 'Vinheta Abertura', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '2', name: 'Comercial 30s', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: '3', name: 'Efeito Transição', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
];

const LOCAL_STORAGE_KEY = 'radio_vignettes_fallback';

const getLocalVignettes = (): Vignette[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalVignettes = (vignettes: Vignette[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(vignettes));
};

export const vignetteService = {
  async getAll(): Promise<Vignette[]> {
    try {
      const { data, error } = await supabase
        .from('vignettes')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.warn('Error fetching vignettes from Supabase, using local fallback:', error);
        const local = getLocalVignettes();
        return local.length > 0 ? local : DEFAULT_VIGNETTES;
      }
      return data && data.length > 0 ? data : DEFAULT_VIGNETTES;
    } catch (err) {
      console.error('Vignette service error, using local fallback:', err);
      const local = getLocalVignettes();
      return local.length > 0 ? local : DEFAULT_VIGNETTES;
    }
  },

  async create(vignette: Omit<Vignette, 'id'>): Promise<Vignette | null> {
    try {
      const { data, error } = await supabase
        .from('vignettes')
        .insert([vignette])
        .select()
        .single();
      
      if (error) {
        console.warn('Error creating vignette in Supabase, saving locally:', error);
        const local = getLocalVignettes();
        const newVignette = { ...vignette, id: `local-${Date.now()}` };
        saveLocalVignettes([...local, newVignette]);
        return newVignette;
      }
      return data;
    } catch (err) {
      const local = getLocalVignettes();
      const newVignette = { ...vignette, id: `local-${Date.now()}` };
      saveLocalVignettes([...local, newVignette]);
      return newVignette;
    }
  },

  async update(id: string, vignette: Partial<Vignette>): Promise<Vignette | null> {
    try {
      const { data, error } = await supabase
        .from('vignettes')
        .update(vignette)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.warn('Error updating vignette in Supabase, updating locally:', error);
        const local = getLocalVignettes();
        const updated = local.map(v => v.id === id ? { ...v, ...vignette } : v);
        saveLocalVignettes(updated);
        return updated.find(v => v.id === id) || null;
      }
      return data;
    } catch (err) {
      const local = getLocalVignettes();
      const updated = local.map(v => v.id === id ? { ...v, ...vignette } : v);
      saveLocalVignettes(updated);
      return updated.find(v => v.id === id) || null;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('vignettes')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.warn('Error deleting vignette from Supabase, deleting locally:', error);
        const local = getLocalVignettes();
        saveLocalVignettes(local.filter(v => v.id !== id));
        return true;
      }
      return true;
    } catch (err) {
      const local = getLocalVignettes();
      saveLocalVignettes(local.filter(v => v.id !== id));
      return true;
    }
  }
};
