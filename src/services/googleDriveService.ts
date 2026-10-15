import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

// Inisialisasi Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Scope Google Drive file
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory & session storage cache untuk Access Token
const STORAGE_ACCESS_TOKEN_KEY = 'gdrive_oauth_access_token_v1';
let cachedAccessToken: string | null = (() => {
  try {
    return sessionStorage.getItem(STORAGE_ACCESS_TOKEN_KEY) || null;
  } catch {
    return null;
  }
})();
let isSigningIn = false;

export const getCachedAccessTokenSync = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const stored = sessionStorage.getItem(STORAGE_ACCESS_TOKEN_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch {}
  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = getCachedAccessTokenSync();
    if (user && token) {
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      if (!isSigningIn) {
        if (!user) {
          cachedAccessToken = null;
          try {
            sessionStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
          } catch {}
        }
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }

    cachedAccessToken = credential.accessToken;
    try {
      sessionStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, cachedAccessToken);
    } catch {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getCachedAccessTokenSync();
};

/**
 * Verifikasi apakah access token Google Drive saat ini masih aktif dan valid
 */
export async function verifyGoogleDriveToken(): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  const token = getCachedAccessTokenSync();
  const currentUser = auth.currentUser;

  if (!token) {
    return {
      valid: false,
      error: 'Token otorisasi Google Drive tidak ditemukan. Silakan login ulang.'
    };
  }

  try {
    // Probe ringan ke Google Drive API untuk memastikan token belum kedaluwarsa
    const probeUrl = 'https://www.googleapis.com/drive/v3/about?fields=user';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(probeUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        email: data.user?.emailAddress || currentUser?.email || undefined
      };
    } else if (response.status === 401 || response.status === 403) {
      // Token kedaluwarsa
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
      } catch {}
      return {
        valid: false,
        error: 'Sesi otorisasi Google telah kedaluwarsa (401). Silakan relogin.'
      };
    } else {
      // Respons non-401 (misal network quirk)
      return {
        valid: true,
        email: currentUser?.email || undefined
      };
    }
  } catch {
    // Jika timeout atau offline, jika token tersimpan di cache, kita anggap token tersedia
    if (token) {
      return {
        valid: true,
        email: currentUser?.email || undefined
      };
    }
    return {
      valid: false,
      error: 'Gagal memvalidasi token Google Drive'
    };
  }
}

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
  } catch {}
};

export interface UploadDriveResult {
  fileId: string;
  name: string;
  webViewLink: string;
  folderId?: string;
}

/**
 * Mendapatkan atau membuat folder 'Unboxing_Retur_Gudang' di Google Drive
 */
async function getOrCreateFolder(accessToken: string, folderName: string = 'Unboxing_Retur_Gudang'): Promise<string> {
  const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`;

  try {
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
  } catch (err) {
    console.warn('Gagal mencari folder di drive:', err);
  }

  // Buat folder baru jika belum ada
  const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder penyimpanan otomatis bukti video rekaman unboxing paket retur gudang'
    })
  });

  if (!createFolderRes.ok) {
    throw new Error(`Gagal membuat folder di Google Drive: ${createFolderRes.statusText}`);
  }

  const folderData = await createFolderRes.json();
  return folderData.id;
}

/**
 * Auto-Upload video Blob langsung ke Google Drive via REST API v3 Multipart
 */
export async function uploadVideoToGoogleDrive(
  videoBlob: Blob,
  fileName: string,
  orderId?: string
): Promise<UploadDriveResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Belum login ke Google Drive. Silakan hubungkan akun Google Anda terlebih dahulu.');
  }

  // Pastikan folder penampung siap
  const folderId = await getOrCreateFolder(accessToken, 'Unboxing_Retur_Gudang');

  const cleanFileName = fileName.endsWith('.mp4') ? fileName : `${fileName.replace(/\.(mp4|webm)$/i, '')}.mp4`;

  const metadata = {
    name: cleanFileName,
    mimeType: 'video/mp4',
    description: `Bukti Rekaman Video Unboxing Paket Retur Order ID: ${orderId || 'N/A'}. Diproses pada ${new Date().toISOString()}`,
    parents: [folderId]
  };

  const boundary = '-------UnboxingStationDriveBoundary' + Date.now().toString(16);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = new Blob([
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: video/mp4\r\n\r\n`
  ], { type: 'text/plain' });

  const multipartBody = new Blob(
    [metadataPart, videoBlob, new Blob([closeDelimiter], { type: 'text/plain' })],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Drive Upload Error Details:', errorBody);
    throw new Error(`Gagal mengunggah video ke Google Drive (${response.status}): ${response.statusText}`);
  }

  const result = await response.json();

  return {
    fileId: result.id,
    name: result.name || fileName,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    folderId
  };
}
