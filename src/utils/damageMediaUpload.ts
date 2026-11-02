import { DamagePhoto } from '../types/damage';
import { toast } from 'sonner';

/**
 * Uploads a file to the existing media server task_upload.php endpoint
 * No new server-side PHP files are created.
 */
export async function uploadDamagePhoto(
  file: File,
  authorId: string = 'system'
): Promise<DamagePhoto> {
  const serverUrl = import.meta.env.VITE_MEDIA_SERVER_URL;
  const apiKey = import.meta.env.VITE_MEDIA_API_KEY;

  if (!serverUrl || !apiKey) {
    throw new Error('Media server configuration is missing in environment variables');
  }

  const formData = new FormData();
  formData.append('media', file, file.name);
  formData.append('uploaded_by', authorId);

  const res = await fetch(`${serverUrl}/task_upload.php`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed with server status ${res.status}`);
  }

  const data = await res.json();
  if (!data || !data.url) {
    throw new Error(data?.error || 'Unknown error response from media server');
  }

  return {
    name: file.name,
    url: data.url,
    type: file.type,
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };
}

/**
 * Upload multiple damage photos sequentially or in parallel
 */
export async function uploadMultipleDamagePhotos(
  files: File[],
  authorId: string = 'system',
  onProgress?: (completed: number, total: number) => void
): Promise<DamagePhoto[]> {
  const results: DamagePhoto[] = [];
  let completed = 0;

  for (const file of files) {
    try {
      const uploaded = await uploadDamagePhoto(file, authorId);
      results.push(uploaded);
      completed++;
      if (onProgress) onProgress(completed, files.length);
    } catch (err: any) {
      console.error(`Failed to upload ${file.name}:`, err);
      toast.error(`Failed to upload photo "${file.name}": ${err?.message || 'Error'}`);
    }
  }

  return results;
}
