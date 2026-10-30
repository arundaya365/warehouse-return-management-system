export function validateReturnRows(rows: unknown, orderId?: unknown): string | null {
  if (!Array.isArray(rows)) return 'rows harus berupa daftar barang retur.';
  if (orderId !== undefined && (typeof orderId !== 'string' || !orderId.trim())) return 'Nomor pesanan tidak valid.';
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return 'Setiap barang retur harus berupa objek.';
    for (const key of ['Order_ID','SKU_ID','Nama_Barang','Operator_ID','Waktu_Proses','Kondisi']) {
      if (typeof row[key] !== 'string' || !row[key].trim()) return `Kolom ${key} wajib diisi dengan teks.`;
    }
    if (orderId && row.Order_ID !== orderId) return 'Daftar barang harus sesuai dengan nomor pesanan yang disimpan.';
  }
  if (!orderId && new Set(rows.map(row=>row.Order_ID)).size > 1) return 'Penyimpanan satu pesanan tidak boleh berisi beberapa nomor pesanan.';
  return null;
}
