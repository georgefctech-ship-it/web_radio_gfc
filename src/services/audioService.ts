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
      // First, try to get from the database table for better metadata (including external URLs)
      const { data: dbData, error: dbError } = await supabase
        .from('audio_files')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: true });

      if (!dbError && dbData && dbData.length > 0) {
        return dbData.map(file => ({
          id: file.id,
          name: file.name,
          fileName: file.file_name || '',
          url: file.url,
          type: file.type
        }));
      }

      // Fallback to storage listing if table is empty or fails
      const { data, error } = await supabase.storage.from(bucket).list();
      if (error) throw error;

      if (!data) return [];

      return data
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => ({
          id: file.id,
          name: file.name.replace(/\.[^/.]+$/, "").replace(/^\d+-/, ""),
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

  async saveMetadata(file: Omit<AudioFile, 'id'>) {
    try {
      const { data, error } = await supabase
        .from('audio_files')
        .insert([{
          name: file.name,
          url: file.url,
          type: file.type,
          file_name: file.fileName
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error saving audio metadata:', err);
      return null;
    }
  },

  async uploadFile(bucket: string, file: File | Blob, fileName: string, type: 'vignette' | 'track' | 'commercial'): Promise<string | null> {
    try {
      const path = `${Date.now()}-${fileName}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file);
      
      if (error) {
        console.error('Supabase Storage Upload Error:', error);
        throw new Error(`Erro no Storage: ${error.message}`);
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
        
      // Save to metadata table
      await this.saveMetadata({
        name: fileName.replace(/\.[^/.]+$/, ""),
        fileName: path,
        url: publicUrl,
        type
      });

      return publicUrl;
    } catch (err: any) {
      console.error(`Error uploading file to bucket ${bucket}:`, err);
      throw err;
    }
  },

  async deleteFile(bucket: string, fileName: string, id?: string): Promise<boolean> {
    try {
      // Delete from storage if fileName exists
      if (fileName) {
        await supabase.storage.from(bucket).remove([fileName]);
      }
      
      // Delete from metadata table
      if (id) {
        await supabase
          .from('audio_files')
          .delete()
          .eq('id', id);
      } else if (fileName) {
        await supabase
          .from('audio_files')
          .delete()
          .eq('file_name', fileName);
      }

      return true;
    } catch (err) {
      console.error(`Error deleting file from bucket ${bucket}:`, err);
      return false;
    }
  }
};
