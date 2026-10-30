import type { RmaClaimRecord } from '../types/rma';

export const normalizeOrderId = (value: unknown) => String(value || '').trim().toUpperCase();

type MarketplaceItem = {claimStatus: string; claimAmount?: number; approvedAmount?: number; settlementAmount?: number};
export function approvedMarketplaceAmount(item: MarketplaceItem): number {
  if (!['APPROVED', 'PARTIAL'].includes(item.claimStatus)) return 0;
  return Math.max(0, Number(item.approvedAmount ?? item.settlementAmount ?? 0));
}
export function uncoveredClaimAmount(item: MarketplaceItem): number {
  return Math.max(0, (Number(item.claimAmount) || 0) - approvedMarketplaceAmount(item));
}
export function getEscalationError(items: MarketplaceItem[], alreadyForwarded = false): string | null {
  if (alreadyForwarded) return 'Kasus sudah diserahkan ke RMA. Hasil marketplace dikunci; pembayaran tetap dapat dicatat.';
  if (!items.length || !items.some(item => item.claimStatus === 'REJECTED' || (item.claimStatus === 'PARTIAL' && uncoveredClaimAmount(item) > 0))) return 'Simpan hasil penolakan atau persetujuan sebagian marketplace terlebih dahulu.';
  if (items.some(item => !['APPROVED', 'PARTIAL', 'REJECTED'].includes(item.claimStatus))) return 'Selesaikan pencatatan hasil marketplace untuk semua barang terlebih dahulu.';
  if (items.some(item => item.claimStatus === 'PARTIAL' && !(approvedMarketplaceAmount(item) > 0))) return 'Isi nominal yang disetujui marketplace untuk barang dengan hasil sebagian.';
  return null;
}
export const rejectedItems = <T extends MarketplaceItem>(items: T[]): T[] => items.filter(item => item.claimStatus === 'REJECTED' || (item.claimStatus === 'PARTIAL' && uncoveredClaimAmount(item) > 0));

export const isRmaClosed = (stage: string) => ['SELESAI', 'TIDAK_LAYAK'].includes(stage);
export const RMA_TRANSITIONS: Record<string,string[]> = {
  DITERIMA_CS:['DITERIMA_RMA'], DIALIHKAN_KE_RMA:['DITERIMA_RMA'],
  DITERIMA_RMA:['BUKTI_KURANG','LAYAK_LOGISTIK','TIDAK_LAYAK'],
  BUKTI_KURANG:['DITERIMA_RMA','LAYAK_LOGISTIK','TIDAK_LAYAK'],
  LAYAK_LOGISTIK:['DRAF_LOGISTIK'], DRAF_LOGISTIK:['DIAJUKAN_LOGISTIK'],
  DIAJUKAN_LOGISTIK:['MENUNGGU_LOGISTIK','HASIL_LOGISTIK'], MENUNGGU_LOGISTIK:['HASIL_LOGISTIK'],
  HASIL_LOGISTIK:['SELESAI'], INVESTIGASI:['DITERIMA_RMA'],
};
export const rmaActionLabel = (stage: string) => ({DITERIMA_RMA:'Terima kasus', BUKTI_KURANG:'Minta bukti tambahan', LAYAK_LOGISTIK:'Nyatakan layak', TIDAK_LAYAK:'Tutup: tidak layak', DRAF_LOGISTIK:'Siapkan banding logistik', DIAJUKAN_LOGISTIK:'Catat pengajuan logistik', MENUNGGU_LOGISTIK:'Tandai menunggu keputusan', HASIL_LOGISTIK:'Catat keputusan logistik', SELESAI:'Tutup kasus'}[stage] || 'Simpan perubahan');
export const rmaQueue = (stage: string) => ['DIALIHKAN_KE_RMA','DITERIMA_CS'].includes(stage) ? 'RECEIVE' : isRmaClosed(stage) ? 'CLOSED' : ['BUKTI_KURANG','DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK','HASIL_LOGISTIK'].includes(stage) ? 'WAITING' : 'ACTIVE';
export function paymentStatus(approved: number, received: number) {
  return approved <= 0 ? 'NOT_APPLICABLE' : received >= approved ? 'RECEIVED' : received > 0 ? 'PARTIAL' : 'WAITING';
}
export function validateRmaWorkflow(previous: RmaClaimRecord, next: RmaClaimRecord): string | null {
  const nextStage = next.stageStatus;
  if (isRmaClosed(previous.stageStatus) && previous.stageStatus !== nextStage) return 'Kasus yang sudah ditutup tidak dapat dibuka ulang melalui perubahan status.';
  const later = ['DRAF_LOGISTIK','DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK','HASIL_LOGISTIK','SELESAI'];
  if (nextStage !== previous.stageStatus) {
    if (!RMA_TRANSITIONS[previous.stageStatus]?.includes(nextStage)) return 'Ikuti urutan penerimaan RMA, pemeriksaan kelayakan, pengajuan, lalu hasil logistik.';
  }
  if (!next.rmaInvestigator?.trim()) return 'Isi penanggung jawab RMA.';
  if (['BUKTI_KURANG','LAYAK_LOGISTIK','TIDAK_LAYAK'].includes(nextStage) && !next.eligibilityReason?.trim()) return 'Isi dasar kelayakan atau rincian bukti yang masih kurang.';
  if (nextStage === 'LAYAK_LOGISTIK' && !next.evidenceReference?.trim()) return 'Cantumkan referensi bukti yang telah diperiksa RMA.';
  if (later.includes(nextStage) && next.eligibility !== 'ELIGIBLE' && previous.stageStatus !== 'INVESTIGASI' && !isRmaClosed(previous.stageStatus)) return 'RMA harus menetapkan kasus layak sebelum mengajukan ke logistik.';
  if (['DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK','HASIL_LOGISTIK'].includes(nextStage) && !next.logisticsTicket?.trim()) return 'Isi nomor tiket atau referensi pengajuan logistik.';
  if (['HASIL_LOGISTIK','SELESAI'].includes(nextStage)) {
    if (!next.logisticsOutcome) return 'Pilih hasil keputusan logistik.';
    const approved = next.approvedAmount ?? next.approvedCompensation ?? 0;
    const received = next.approvedCompensation ?? 0;
    if (![approved,received].every(value => Number.isSafeInteger(value) && value >= 0) || received > approved || approved > next.estimatedCompensation) return 'Periksa nominal: diterima tidak boleh melebihi disetujui, dan disetujui tidak boleh melebihi tuntutan.';
    if (next.logisticsOutcome === 'REJECTED' && (approved !== 0 || received !== 0)) return 'Banding ditolak harus memiliki nominal disetujui dan diterima Rp0.';
    if (next.logisticsOutcome === 'APPROVED' && approved !== next.estimatedCompensation) return 'Gunakan hasil disetujui sebagian jika nominal tidak penuh.';
    if (next.logisticsOutcome !== 'REJECTED' && approved <= 0) return 'Isi nominal yang disetujui logistik.';
    if (!next.resolutionNote?.trim()) return 'Isi catatan keputusan logistik.';
    if (nextStage === 'SELESAI' && received < approved && !next.closureReason?.trim()) return 'Dana belum seluruhnya diterima. Tunggu pembayaran atau isi alasan penutupan tanpa pelunasan.';
  }
  return null;
}

export function logisticsChannel(value: string): RmaClaimRecord['channel'] {
  const channel = value.toLowerCase();
  if (channel.includes('j&t')) return 'J&T Express';
  if (channel.includes('sicepat')) return 'SiCepat';
  if (channel.includes('spx') || channel.includes('shopee express')) return 'SPX Express';
  if (channel.includes('jne')) return 'JNE';
  if (channel.includes('anteraja')) return 'Anteraja';
  if (channel.includes('ninja')) return 'Ninja Xpress';
  return 'Lainnya';
}

// Old clients wrote canonical and legacy keys for the same item. Count it once.
export function marketplaceSettlement(records: Record<string, any>, activeOrderIds: Set<string>): {claimAmount: number; settlementAmount: number} {
  const unique = new Map<string, {record: any; canonical: boolean}>();
  for (const [key, record] of Object.entries(records)) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || key.startsWith('_')) continue;
    const orderId = normalizeOrderId(record.row?.Order_ID || record.orderId || key.split('__')[0]);
    if (!activeOrderIds.has(orderId)) continue;
    const index = key.match(/(?:__|_)(\d+)$/)?.[1] || '0';
    const identity = JSON.stringify([orderId, record.row?.SKU_ID || key, index]);
    const canonical = key.includes('__');
    const previous = unique.get(identity);
    if (!previous || (canonical && !previous.canonical) || (canonical === previous.canonical && String(record.updatedAt || '') > String(previous.record.updatedAt || ''))) {
      unique.set(identity, {record, canonical});
    }
  }
  let claimAmount = 0;
  let settlementAmount = 0;
  for (const {record} of unique.values()) {
    claimAmount += Math.max(0, Number(record.claimAmount) || 0);
    if (['APPROVED', 'PARTIAL'].includes(record.claimStatus)) settlementAmount += Math.max(0, Number(record.settlementAmount) || 0);
  }
  return {claimAmount, settlementAmount};
}

export function validateRmaResolution(stage: string, amount: string, note: string, investigator: string): string | null {
  if (!investigator.trim()) return 'Isi nama penanggung jawab RMA.';
  if (stage === 'SELESAI') {
    if (!/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount))) return 'Isi realisasi logistik. Masukkan 0 jika banding ditolak atau tidak ada pencairan.';
    if (!note.trim()) return 'Isi hasil akhir banding logistik dan alasan penyelesaiannya.';
  }
  return null;
}

export function allocateClaimAmount(total: number, limits: number[]): number[] {
  const capacity = limits.reduce((sum,value) => sum + value,0);
  if (!Number.isSafeInteger(total) || total < 0 || total > capacity || limits.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('Nominal melebihi nilai barang yang dipilih.');
  if (!capacity) return limits.map(() => 0);
  const amounts = limits.map(value => Math.floor(total * value / capacity));
  let remainder = total - amounts.reduce((sum,value) => sum+value,0);
  for (let i=0; i<amounts.length && remainder; i++) { const add=Math.min(remainder,limits[i]-amounts[i]); amounts[i]+=add; remainder-=add; }
  return amounts;
}

export function rmaCashReceived(claim: RmaClaimRecord): number {
  return ['HASIL_LOGISTIK','SELESAI'].includes(claim.stageStatus) ? Math.max(0,Number(claim.approvedCompensation)||0) : 0;
}

export function validateClaimPayload(previous: Record<string,any>, incoming: Record<string,any>): string | null {
  const nextClaims = incoming._rma_claims_list_;
  if (nextClaims === undefined) return null;
  if (!Array.isArray(nextClaims)) return 'Daftar RMA tidak valid.';
  const oldClaims: RmaClaimRecord[] = Array.isArray(previous._rma_claims_list_) ? previous._rma_claims_list_ : [];
  const seen = new Set<string>();
  for (const next of nextClaims as RmaClaimRecord[]) {
    if (!next || typeof next !== 'object' || !Array.isArray(next.items) || next.items.some(item=>!item || typeof item!=='object')) return 'Data kasus RMA tidak valid.';
    const order = normalizeOrderId(next.orderId);
    if (!order || seen.has(order)) return 'Satu order hanya boleh memiliki satu kasus RMA aktif dalam daftar.';
    seen.add(order);
    const old = oldClaims.find(claim => claim.id === next.id);
    if (old) {
      if (JSON.stringify(old) !== JSON.stringify(next)) {
        const error = validateRmaWorkflow(old,next);
        if (error) return error;
      }
      continue;
    }
    if (oldClaims.some(claim => normalizeOrderId(claim.orderId) === order)) return 'Order ini sudah memiliki kasus RMA.';
    if (next.stageStatus !== 'DIALIHKAN_KE_RMA' || !next.marketplaceDecisionEvidence?.trim() || !next.marketplaceRejectionReason?.trim()) return 'Serah terima memerlukan alasan dan referensi keputusan marketplace.';
    let entries = Object.entries(previous).filter(([key,item]) => !key.startsWith('_') && item?.row && normalizeOrderId(item.row.Order_ID) === order);
    if (entries.some(([key])=>key.includes('__'))) entries=entries.filter(([key])=>key.includes('__'));
    const items = entries.map(([,item])=>item);
    const error=getEscalationError(items);
    if (error) return error;
    const remaining = rejectedItems(items).reduce((sum,item)=>sum+uncoveredClaimAmount(item),0);
    if (!Number.isSafeInteger(next.estimatedCompensation) || next.estimatedCompensation<=0 || next.estimatedCompensation>remaining) return 'Tuntutan RMA melebihi sisa klaim marketplace.';
    const failedSkus=new Set(rejectedItems(items).map(item=>item.row.SKU_ID));
    if (!next.items?.length || next.items.some(item=>!failedSkus.has(item.skuId) || item.kondisi==='Good')) return 'RMA hanya boleh menangani bagian barang yang gagal di marketplace.';
  }
  return null;
}
