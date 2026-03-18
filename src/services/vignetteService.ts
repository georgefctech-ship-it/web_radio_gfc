import { supabase } from '../lib/supabase';

export interface Vignette {
  id: string;
  name: string;
  url: string;
  created_at?: string;
  path?: string;
  source?: 'storage' | 'database' | 'local';
}

const DEFAULT_VIGNETTES: Vignette[] = [
  { id: 'test-1', name: 'Vinheta de Teste (George)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', source: 'local' },
  { id: '1', name: 'Vinheta Abertura', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', source: 'local' },
  { id: '2', name: 'Comercial 30s', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', source: 'local' },
  { id: '3', name: 'Efeito Transição', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', source: 'local' },
];

const LOCAL_STORAGE_KEY = 'radio_vignettes_fallback';
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_VIGNETTE_BUCKET || 'vinhetas';

const getLocalVignettes = (): Vignette[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveLocalVignettes = (vignettes: Vignette[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(vignettes));
};

const sanitizeFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const fileNameWithoutExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

const mapStorageFileToVignette = (file: { name: string; created_at?: string }) => {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(file.name);

  return {
    id: `storage-${file.name}`,
    name: fileNameWithoutExtension(file.name),
    url: data.publicUrl,
    created_at: file.created_at,
    path: file.name,
    source: 'storage' as const,
  };
};

const mergeVignettes = (...groups: Vignette[][]) => {
  const merged = new Map<string, Vignette>();

  groups.flat().forEach((vignette) => {
    merged.set(vignette.id, vignette);
  });

  return Array.from(merged.values());
};

export const vignetteService = {
  async getAll(): Promise<Vignette[]> {
    try {
      const [storageResult, dbResult] = await Promise.all([
        supabase.storage.from(STORAGE_BUCKET).list('', {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' },
        }),
        supabase.from('vignettes').select('*').order('created_at', { ascending: true }),
      ]);

      if (storageResult.error) {
        console.warn('Error fetching vignette files from Supabase Storage:', storageResult.error);
      }

      if (dbResult.error) {
        console.warn('Error fetching vignette rows from Supabase:', dbResult.error);
      }

      const storageVignettes = (storageResult.data || [])
        .filter((file: any) => file.name && file.metadata)
        .map((file) => mapStorageFileToVignette(file));

      const dbVignettes = (dbResult.data || []).map((item: any) => ({
        ...item,
        source: 'database' as const,
      }));

      const localVignettes = getLocalVignettes().map((item) => ({ ...item, source: item.source || 'local' as const }));
      const merged = mergeVignettes(storageVignettes, dbVignettes, localVignettes);

      if (merged.length > 0) {
        return merged;
      }

      return DEFAULT_VIGNETTES;
    } catch (err) {
      console.error('Vignette service error, using local fallback:', err);
      const local = getLocalVignettes();
      return local.length > 0 ? local : DEFAULT_VIGNETTES;
    }
  },

  async upload(file: File, customName?: string): Promise<Vignette | null> {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const normalizedBaseName = sanitizeFileName(customName || fileNameWithoutExtension(file.name) || `vinheta-${Date.now()}`);
    const finalPath = `${normalizedBaseName}.${extension}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(finalPath, file, { upsert: true, contentType: file.type || `audio/${extension}` });

    if (error) {
      console.warn('Error uploading vignette to Supabase Storage, saving locally:', error);
      const local = getLocalVignettes();
      const localVignette = {
        id: `local-${Date.now()}`,
        name: customName || fileNameWithoutExtension(file.name),
        url: URL.createObjectURL(file),
        source: 'local' as const,
      };
      saveLocalVignettes([...local, localVignette]);
      return localVignette;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(finalPath);
    return {
      id: `storage-${finalPath}`,
      name: customName || fileNameWithoutExtension(file.name),
      url: data.publicUrl,
      path: finalPath,
      source: 'storage',
    };
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
        const newVignette = { ...vignette, id: `local-${Date.now()}`, source: 'local' as const };
        saveLocalVignettes([...local, newVignette]);
        return newVignette;
      }

      return { ...data, source: 'database' as const };
    } catch (err) {
      const local = getLocalVignettes();
      const newVignette = { ...vignette, id: `local-${Date.now()}`, source: 'local' as const };
      saveLocalVignettes([...local, newVignette]);
      return newVignette;
    }
  },

  async update(id: string, vignette: Partial<Vignette>): Promise<Vignette | null> {
    const isStorageVignette = id.startsWith('storage-');

    if (isStorageVignette) {
      const currentPath = vignette.path || id.replace(/^storage-/, '');
      if (!currentPath) return null;

      const extension = currentPath.split('.').pop() || 'mp3';
      const nextBaseName = sanitizeFileName(vignette.name || fileNameWithoutExtension(currentPath));
      const nextPath = `${nextBaseName}.${extension}`;

      if (nextPath !== currentPath) {
        const { error } = await supabase.storage.from(STORAGE_BUCKET).move(currentPath, nextPath);
        if (error) {
          console.warn('Error renaming vignette in Supabase Storage:', error);
          return null;
        }
      }

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(nextPath);
      return {
        id: `storage-${nextPath}`,
        name: vignette.name || fileNameWithoutExtension(nextPath),
        url: data.publicUrl,
        path: nextPath,
        source: 'storage',
      };
    }

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
        const updated = local.map((item) => (item.id === id ? { ...item, ...vignette } : item));
        saveLocalVignettes(updated);
        return updated.find((item) => item.id === id) || null;
      }

      return { ...data, source: 'database' as const };
    } catch (err) {
      const local = getLocalVignettes();
      const updated = local.map((item) => (item.id === id ? { ...item, ...vignette } : item));
      saveLocalVignettes(updated);
      return updated.find((item) => item.id === id) || null;
    }
  },

  async delete(id: string, path?: string): Promise<boolean> {
    if (id.startsWith('storage-')) {
      const targetPath = path || id.replace(/^storage-/, '');
      const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([targetPath]);
      if (error) {
        console.warn('Error deleting vignette from Supabase Storage:', error);
        return false;
      }
      return true;
    }

    try {
      const { error } = await supabase
        .from('vignettes')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Error deleting vignette from Supabase, deleting locally:', error);
        const local = getLocalVignettes();
        saveLocalVignettes(local.filter((item) => item.id !== id));
        return true;
      }

      return true;
    } catch (err) {
      const local = getLocalVignettes();
      saveLocalVignettes(local.filter((item) => item.id !== id));
      return true;
    }
  }
};
