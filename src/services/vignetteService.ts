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

export const vignetteService = {
  async getAll(): Promise<Vignette[]> {
    try {
      const { data, error } = await supabase
        .from('vignettes')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.warn('Error fetching vignettes from Supabase, using defaults:', error);
        return DEFAULT_VIGNETTES;
      }
      return data && data.length > 0 ? data : DEFAULT_VIGNETTES;
    } catch (err) {
      console.error('Vignette service error, using defaults:', err);
      return DEFAULT_VIGNETTES;
    }
  },

  async create(vignette: Omit<Vignette, 'id'>): Promise<Vignette | null> {
    const { data, error } = await supabase
      .from('vignettes')
      .insert([vignette])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating vignette:', error);
      return null;
    }
    return data;
  },

  async update(id: string, vignette: Partial<Vignette>): Promise<Vignette | null> {
    const { data, error } = await supabase
      .from('vignettes')
      .update(vignette)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating vignette:', error);
      return null;
    }
    return data;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('vignettes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting vignette:', error);
      return false;
    }
    return true;
  }
};
