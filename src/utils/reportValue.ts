type MasterPrice = {SKU_ID: string; BARCODE?: string; HARGA?: number};
export function rowValue(row: {SKU_ID: string}, master: MasterPrice[]): number | undefined {
  const sku = String(row.SKU_ID || '').trim().toUpperCase();
  if (!sku) return undefined;
  const match = master.find(item=>String(item.SKU_ID || '').trim().toUpperCase()===sku || String(item.BARCODE || '').trim().toUpperCase()===sku);
  if (match?.HARGA === undefined || match.HARGA === null || !Number.isFinite(match.HARGA) || match.HARGA < 0) return undefined;
  return match.HARGA;
}
export function summarizeValues(rows: {SKU_ID:string}[], master: MasterPrice[]) {
  return rows.reduce((result,row)=>{const value=rowValue(row,master);if(value===undefined) result.missing++;else result.total+=value;return result;},{total:0,missing:0});
}
