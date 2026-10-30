export function googleAuthErrorMessage(error: unknown, hostname = 'localhost'): string {
  const code = String((error as {code?: string})?.code || (error as Error)?.message || '');
  if (code.includes('unauthorized-domain')) return `Login Google belum mengizinkan alamat ${hostname}. Pemilik proyek perlu menambahkan ${hostname} di Firebase Authentication > Settings > Authorized domains. Login operator tetap dapat digunakan. Menyimpan email saja tidak menghubungkan Google Drive.`;
  if (code.includes('popup-blocked')) return 'Popup login Google diblokir browser. Izinkan popup untuk aplikasi ini, lalu klik Hubungkan Google Drive lagi.';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Login Google dibatalkan. Klik Hubungkan Google Drive untuk mencoba lagi.';
  if (code.includes('operation-not-allowed') || code.includes('configuration-not-found')) return 'Login Google belum diaktifkan pada proyek Firebase. Pemilik proyek perlu mengaktifkan Google di Authentication > Sign-in method.';
  if (code.includes('invalid-api-key') || code.includes('api-key-not-valid') || code.includes('invalid-app-credential')) return 'Konfigurasi Firebase tidak valid. Periksa API key, project ID, dan auth domain dari aplikasi web pada proyek Firebase yang benar.';
  if (code.includes('network-request-failed')) return 'Tidak dapat menghubungi layanan login Google. Periksa internet lalu coba lagi; data laptop tetap tersedia.';
  return 'Google Drive belum berhasil dihubungkan. Periksa konfigurasi Firebase dan koneksi internet, lalu coba lagi. Login operator tetap dapat digunakan.';
}
