import { supabase } from '../lib/supabase';

export interface AudioFile {
  id: string;
  name: string;
  fileName: string;
  url: string;
  type: 'vignette' | 'track' | 'commercial';
}

export const audioService = {
  async listFiles(bucket: string, type: 'vignette' | 'track' | 'commercial'): Promise<AudioFile[]> {
    try {
      const { data, error } = await supabase.storage.from(bucket).list();
      if (error) throw error;

      if (!data) return [];

      return data
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => ({
          id: file.id,
          name: file.name.replace(/\.[^/.]+$/, "").replace(/^\d+-/, ""), // Remove extension and timestamp prefix
          fileName: file.name,
          url: supabase.storage.from(bucket).getPublicUrl(file.name).data.publicUrl,
          type
        }));
    } catch (err) {
      console.error(`Error listing files from bucket ${bucket}:`, err);
      return [];
    }
  },

  async getAllStudioAudio() {
    const [vignettes, tracks, commercials] = await Promise.all([
      this.listFiles('vinhetas', 'vignette'),
      this.listFiles('trilhas', 'track'),
      this.listFiles('comerciais', 'commercial')
    ]);

    return { vignettes, tracks, commercials };
  },

  async uploadFile(bucket: string, file: File | Blob, fileName: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(`${Date.now()}-${fileName}`, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
        
      return publicUrl;
    } catch (err) {
      console.error(`Error uploading file to bucket ${bucket}:`, err);
      return null;
    }
  },

  async deleteFile(bucket: string, fileName: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([fileName]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error(`Error deleting file from bucket ${bucket}:`, err);
      return false;
    }
  }
};
