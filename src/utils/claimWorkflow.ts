import type { RmaClaimRecord } from '../types/rma';

export const normalizeOrderId = (value: unknown) => String(value || '').trim().toUpperCase();

type MarketplaceItem = {closedAt?: string; claimStatus: string; claimAmount?: number; approvedAmount?: number; settlementAmount?: number};
export function approvedMarketplaceAmount(item: MarketplaceItem): number {
  if (!['APPROVED', 'PARTIAL'].includes(item.claimStatus)) return 0;
  return Math.max(0, Number(item.approvedAmount ?? item.settlementAmount ?? 0));
}
export function uncoveredClaimAmount(item: MarketplaceItem): number {
  return Math.max(0, (Number(item.claimAmount) || 0) - Math.max(approvedMarketplaceAmount(item), Number(item.settlementAmount) || 0));
}
export function getEscalationError(items: MarketplaceItem[], alreadyForwarded = false): string | null {
  if (items.length && items.every(item=>!!item.closedAt)) return 'Kasus CS sudah ditutup dan tidak dapat diserahkan ke RMA.';
  if (alreadyForwarded) return 'Kasus sudah diserahkan ke RMA. Hasil marketplace dikunci; pembayaran tetap dapat dicatat.';
  if (!rejectedItems(items).length) return 'Tidak ada barang bermasalah yang perlu dipindahkan ke RMA.';
  return null;
}
// CS decides the route without waiting for a marketplace rejection.
export const rejectedItems = <T extends MarketplaceItem>(items: T[]): T[] => items.filter(item => !item.closedAt && item.claimStatus !== 'APPROVED' && (uncoveredClaimAmount(item) > 0 || !(Number(item.claimAmount) > 0)));
export const canReturnToCs = (stage: string) => ['DITERIMA_CS','DIALIHKAN_KE_RMA','DITERIMA_RMA','BUKTI_KURANG','LAYAK_LOGISTIK','DRAF_LOGISTIK','INVESTIGASI'].includes(stage);

export const isRmaClosed = (stage: string) => ['SELESAI', 'TIDAK_LAYAK', 'DIKEMBALIKAN_CS'].includes(stage);
export const RMA_TRANSITIONS: Record<string,string[]> = {
  DITERIMA_CS:['DITERIMA_RMA'], DIALIHKAN_KE_RMA:['DITERIMA_RMA'],
  DITERIMA_RMA:['BUKTI_KURANG','LAYAK_LOGISTIK','TIDAK_LAYAK'],
  BUKTI_KURANG:['DITERIMA_RMA','LAYAK_LOGISTIK','TIDAK_LAYAK'],
  LAYAK_LOGISTIK:['DRAF_LOGISTIK'], DRAF_LOGISTIK:['DIAJUKAN_LOGISTIK'],
  DIAJUKAN_LOGISTIK:['MENUNGGU_LOGISTIK','HASIL_LOGISTIK'], MENUNGGU_LOGISTIK:['HASIL_LOGISTIK'],
  HASIL_LOGISTIK:['SELESAI'], INVESTIGASI:['DITERIMA_RMA'],
};
export const rmaActionLabel = (stage: string) => ({DITERIMA_RMA:'Terima kasus', BUKTI_KURANG:'Minta bukti tambahan', LAYAK_LOGISTIK:'Nyatakan layak', TIDAK_LAYAK:'Tutup: tidak layak', DRAF_LOGISTIK:'Siapkan banding logistik', DIAJUKAN_LOGISTIK:'Catat pengajuan logistik', MENUNGGU_LOGISTIK:'Tandai menunggu keputusan', HASIL_LOGISTIK:'Catat keputusan logistik', SELESAI:'Tutup kasus'}[stage] || 'Simpan perubahan');
export const rmaQueue = (stage: string) => stage === 'DIKEMBALIKAN_CS' ? 'RETURNED' : ['DIALIHKAN_KE_RMA','DITERIMA_CS'].includes(stage) ? 'RECEIVE' : isRmaClosed(stage) ? 'CLOSED' : ['BUKTI_KURANG','DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK','HASIL_LOGISTIK'].includes(stage) ? 'WAITING' : 'ACTIVE';
export function classifyApprovedAmount(approved: number, requested: number): 'APPROVED' | 'PARTIAL' | undefined {
  if (!Number.isSafeInteger(approved) || !Number.isSafeInteger(requested) || approved <= 0 || requested <= 0 || approved > requested) return undefined;
  return approved === requested ? 'APPROVED' : 'PARTIAL';
}
export function paymentStatus(approved: number, received: number) {
  return approved <= 0 ? 'NOT_APPLICABLE' : received >= approved ? 'RECEIVED' : received > 0 ? 'PARTIAL' : 'WAITING';
}
// RMA may value an unpriced handover during review, never silently alter a submitted claim.
export function validateRmaValuation(previous: RmaClaimRecord, next: RmaClaimRecord): string | null {
  if (previous.items.length !== next.items.length) return 'Daftar barang serah terima harus tetap lengkap.';
  const changed = previous.estimatedCompensation !== next.estimatedCompensation || previous.items.some((item,index)=>item.subtotalEstimasi !== next.items[index]?.subtotalEstimasi);
  for (let index=0;index<previous.items.length;index++) {
    const old=previous.items[index], item=next.items[index];
    const {subtotalEstimasi:oldValue,...oldIdentity}=old;
    const {subtotalEstimasi:newValue,...newIdentity}=item;
    if(JSON.stringify(oldIdentity)!==JSON.stringify(newIdentity))return 'Identitas dan bukti barang tidak boleh diubah saat mencatat nominal RMA.';
    if(!Number.isSafeInteger(newValue)||newValue<0)return 'Nominal tuntutan per barang harus berupa rupiah yang valid.';
    const capacity = old.sourceClaimAmount === undefined ? old.subtotalEstimasi : Math.max(0,old.sourceClaimAmount-(old.marketplaceReservedAmount||0));
    if(!old.valuationPending && newValue>capacity)return 'Nilai tuntutan melebihi sisa klaim barang yang sudah diketahui.';
  }
  if (changed) {
    if (!canReturnToCs(previous.stageStatus) || next.stageStatus === 'DIKEMBALIKAN_CS') return 'Nominal pengajuan yang sudah dikirim atau ditutup tidak boleh diubah.';
    if (!Number.isSafeInteger(next.estimatedCompensation) || next.estimatedCompensation<0 || next.items.reduce((sum,item)=>sum+item.subtotalEstimasi,0)!==next.estimatedCompensation) return 'Total tuntutan harus sama dengan jumlah nominal seluruh barang.';
  }
  return null;
}
export type SimpleRmaStatus = 'PENDING' | 'SUBMITTED' | 'WAITING' | 'APPROVED' | 'REJECTED';
export function simpleRmaStatus(claim: RmaClaimRecord): SimpleRmaStatus {
  if (claim.claimStatus) return claim.claimStatus === 'PARTIAL' ? 'APPROVED' : claim.claimStatus;
  if (claim.logisticsOutcome) return claim.logisticsOutcome === 'REJECTED' ? 'REJECTED' : 'APPROVED';
  if (claim.stageStatus === 'DIAJUKAN_LOGISTIK') return 'SUBMITTED';
  if (claim.stageStatus === 'MENUNGGU_LOGISTIK') return 'WAITING';
  return 'PENDING';
}
export function simpleRmaStage(status: NonNullable<RmaClaimRecord['claimStatus']>): RmaClaimRecord['stageStatus'] {
  return status === 'PENDING' ? 'DRAF_LOGISTIK' : status === 'SUBMITTED' ? 'DIAJUKAN_LOGISTIK' : status === 'WAITING' ? 'MENUNGGU_LOGISTIK' : 'HASIL_LOGISTIK';
}
export function validateSimpleRma(previous: RmaClaimRecord, next: RmaClaimRecord): string | null {
  if (['DIKEMBALIKAN_CS','TIDAK_LAYAK'].includes(previous.stageStatus)) return 'Riwayat kasus yang sudah dikembalikan atau dinyatakan tidak layak tetap baca-saja.';
  if (!next.rmaInvestigator?.trim()) return 'Isi penanggung jawab RMA.';
  const status = next.claimStatus;
  if (!status || !['PENDING','SUBMITTED','WAITING','APPROVED','PARTIAL','REJECTED'].includes(status)) return 'Pilih status banding logistik.';
  if (next.stageStatus !== simpleRmaStage(status) && next.stageStatus !== 'SELESAI') return 'Status proses RMA tidak sesuai hasil banding.';
  if (previous.stageStatus === 'SELESAI' && next.stageStatus !== 'SELESAI') return 'Kasus yang ditutup tidak dapat dibuka ulang.';
  const result = ['APPROVED','PARTIAL','REJECTED'].includes(status);
  if ((previous.approvedCompensation || 0) > (next.approvedCompensation || 0)) return 'Dana yang sudah diterima tetap tercatat. Perubahan status tidak boleh menghapus atau mengurangi pembayaran sebelumnya.';
  const requested = next.estimatedCompensation;
  const approved = next.approvedAmount ?? 0;
  const received = next.approvedCompensation ?? 0;
  if (![requested,approved,received].every(value=>Number.isSafeInteger(value)&&value>=0) || received>approved || approved>requested) return 'Periksa nominal: dana diterima tidak boleh melebihi disetujui, dan hasil disetujui tidak boleh melebihi total nilai klaim.';
  if (status !== 'PENDING' && requested<=0) return 'Isi nilai klaim per SKU sebelum mencatat pengajuan atau hasil banding.';
  if (result) {
    if (status === 'REJECTED') {
      if (next.logisticsOutcome !== 'REJECTED' || approved!==0 || received!==0) return 'Banding tidak berhasil memiliki hasil disetujui dan dana diterima Rp0.';
    } else if (classifyApprovedAmount(approved,requested) !== status || next.logisticsOutcome !== status) return 'Hasil penuh atau sebagian harus sesuai nominal yang diketik.';
  } else if (next.logisticsOutcome || approved!==0 || received!==0) return 'Draf atau pengajuan yang belum diputuskan tidak boleh dicatat sebagai persetujuan atau pembayaran.';
  if (next.stageStatus === 'SELESAI' && !result) return 'Catat hasil banding sebelum menutup kasus.';
  if (next.stageStatus === 'SELESAI' && received<approved && !next.closureReason?.trim()) return 'Dana belum lunas. Isi alasan penutupan atau biarkan kasus tetap terbuka.';
  if (previous.stageStatus === 'SELESAI' && previous.workflowVersion === 'SIMPLE' && (next.claimStatus !== previous.claimStatus || next.approvedAmount !== previous.approvedAmount)) return 'Keputusan kasus yang ditutup tetap tersimpan; hanya pembayaran lanjutan dapat dicatat.';
  return null;
}
export function validateRmaWorkflow(previous: RmaClaimRecord, next: RmaClaimRecord): string | null {
  const valuationError = validateRmaValuation(previous,next);
  if (valuationError) return valuationError;
  const nextStage = next.stageStatus;
  if (next.workflowVersion === 'SIMPLE' && nextStage !== 'DIKEMBALIKAN_CS') return validateSimpleRma(previous,next);
  if (previous.workflowVersion === 'SIMPLE' && next.workflowVersion !== 'SIMPLE') return 'Kasus RMA sederhana tidak dapat dikembalikan ke alur lama.';
  if (nextStage === 'DIKEMBALIKAN_CS' && previous.stageStatus !== nextStage) {
    if (!canReturnToCs(previous.stageStatus)) return 'Kasus yang telah diajukan ke logistik atau ditutup tidak dapat dikembalikan ke CS.';
    if (!next.returnReason?.trim() || !next.returnedBy?.trim() || !next.returnedAt) return 'Pengembalian memerlukan alasan, petugas, dan waktu.';
    const allowed = new Set(['stageStatus','returnReason','returnedBy','returnedAt','updatedAt','history']);
    if (Object.keys({...previous,...next}).some(key => !allowed.has(key) && JSON.stringify((previous as any)[key]) !== JSON.stringify((next as any)[key]))) return 'Pengembalian tidak boleh mengubah rincian klaim, keputusan, atau dana.';
    return null;
  }
  if (previous.stageStatus === 'DIKEMBALIKAN_CS' && JSON.stringify(previous) !== JSON.stringify(next)) return 'Riwayat kasus yang dikembalikan tidak dapat diubah.';
  if (isRmaClosed(previous.stageStatus) && previous.stageStatus !== nextStage) return 'Kasus yang sudah ditutup tidak dapat dibuka ulang melalui perubahan status.';
  const later = ['DRAF_LOGISTIK','DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK','HASIL_LOGISTIK','SELESAI'];
  if (nextStage !== previous.stageStatus) {
    if (!RMA_TRANSITIONS[previous.stageStatus]?.includes(nextStage)) return 'Ikuti urutan penerimaan RMA, pemeriksaan kelayakan, pengajuan, lalu hasil logistik.';
  }
  if (!next.rmaInvestigator?.trim()) return 'Isi penanggung jawab RMA.';
  if (['BUKTI_KURANG','LAYAK_LOGISTIK','TIDAK_LAYAK'].includes(nextStage) && !next.eligibilityReason?.trim()) return 'Isi dasar kelayakan atau rincian bukti yang masih kurang.';
  if (nextStage === 'LAYAK_LOGISTIK' && !next.evidenceReference?.trim()) return 'Cantumkan referensi bukti yang telah diperiksa RMA.';
  if (later.includes(nextStage) && next.eligibility !== 'ELIGIBLE' && previous.stageStatus !== 'INVESTIGASI' && !isRmaClosed(previous.stageStatus)) return 'RMA harus menetapkan kasus layak sebelum mengajukan ke logistik.';
  if (['DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK','HASIL_LOGISTIK','SELESAI'].includes(nextStage) && (!Number.isSafeInteger(next.estimatedCompensation) || next.estimatedCompensation <= 0)) return 'RMA perlu melengkapi nominal tuntutan sebelum mencatat pengajuan logistik.';
  if (['DIAJUKAN_LOGISTIK','MENUNGGU_LOGISTIK'].includes(nextStage) && !(next.logisticsName?.trim() || (next.channel !== 'Lainnya' && next.channel))) return 'Pilih ekspedisi tujuan sebelum mencatat pengajuan logistik.';
  if (['HASIL_LOGISTIK','SELESAI'].includes(nextStage)) {
    if (!next.logisticsOutcome) return 'Pilih hasil keputusan logistik.';
    const approved = next.approvedAmount ?? next.approvedCompensation ?? 0;
    const received = next.approvedCompensation ?? 0;
    if (![approved,received].every(value => Number.isSafeInteger(value) && value >= 0) || received > approved || approved > next.estimatedCompensation) return 'Periksa nominal: diterima tidak boleh melebihi disetujui, dan disetujui tidak boleh melebihi tuntutan.';
    if (next.logisticsOutcome === 'REJECTED' && (approved !== 0 || received !== 0)) return 'Banding ditolak harus memiliki nominal disetujui dan diterima Rp0.';
    if (next.logisticsOutcome === 'APPROVED' && approved !== next.estimatedCompensation) return 'Gunakan hasil disetujui sebagian jika nominal tidak penuh.';
    if (next.logisticsOutcome === 'PARTIAL' && approved >= next.estimatedCompensation) return 'Persetujuan sebagian harus kurang dari nilai tuntutan.';
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

export function validateClaimPayload(previous: Record<string,any>, incoming: Record<string,any>, allowAdminReopen = false): string | null {
  const nextClaims = incoming._rma_claims_list_ === undefined ? [] : incoming._rma_claims_list_;
  if (incoming._rma_claims_list_ === undefined && Array.isArray(previous._rma_claims_list_) && previous._rma_claims_list_.length) return 'Muat ulang data klaim sebelum menyimpan agar riwayat RMA tetap lengkap.';
  if (!Array.isArray(nextClaims)) return 'Daftar RMA tidak valid.';
  const oldClaims: RmaClaimRecord[] = Array.isArray(previous._rma_claims_list_) ? previous._rma_claims_list_ : [];
  if (oldClaims.some(old => !nextClaims.some((next:any) => next?.id === old.id))) return 'Riwayat RMA tidak boleh dihapus lewat pembaruan klaim. Muat ulang data terbaru.';
  const ids = new Set<string>();
  const orders = new Set<string>();
  for (const next of nextClaims as RmaClaimRecord[]) {
    if (!next || typeof next !== 'object' || !Array.isArray(next.items) || next.items.some(item=>!item || typeof item!=='object')) return 'Data kasus RMA tidak valid.';
    const order = normalizeOrderId(next.orderId);
    if (!order || !next.id || ids.has(next.id)) return 'Identitas kasus RMA tidak valid atau berulang.';
    ids.add(next.id);
    if (next.stageStatus !== 'DIKEMBALIKAN_CS') {
      if (orders.has(order)) return 'Satu order hanya boleh memiliki satu penanganan RMA.';
      orders.add(order);
    }
    const old = oldClaims.find(claim => claim.id === next.id);
    if (old) {
      if (JSON.stringify(old) !== JSON.stringify(next)) {
        if (old.history?.some((entry,index) => JSON.stringify(entry) !== JSON.stringify(next.history?.[index]))) return 'Riwayat telah berubah. Muat ulang kasus sebelum menyimpan.';
        if (normalizeOrderId(old.orderId) !== order || old.forwardedAt !== next.forwardedAt) return 'Identitas serah terima tidak dapat diubah lewat pembaruan RMA.';
        const superReopen = Boolean(allowAdminReopen && !(old as any).reopenedAt && (next as any).reopenedAt && (next as any).reopenedBySuperAccount?.trim() && (next as any).reopenReason?.trim() && (next as any).previousResolution);
        if (superReopen) continue;
        const valuationError = validateRmaValuation(old,next);
        if (valuationError) return valuationError;
        const error = validateRmaWorkflow(old,next);
        if (error) return error;
      }
      continue;
    }
    if (oldClaims.some(claim => normalizeOrderId(claim.orderId) === order && claim.stageStatus !== 'DIKEMBALIKAN_CS')) return 'Order ini sudah memiliki kasus RMA.';
    if (next.stageStatus !== 'DIALIHKAN_KE_RMA' || !next.forwardedBy?.trim() || !next.forwardedAt) return 'Pemindahan memerlukan identitas petugas dan waktu yang dicatat otomatis.';
    let entries = Object.entries(incoming).filter(([key,item]) => !key.startsWith('_') && item?.row && normalizeOrderId(item.row.Order_ID) === order);
    if (entries.some(([key])=>key.includes('__'))) entries=entries.filter(([key])=>key.includes('__'));
    if (entries.length && entries.every(([,item])=>item.closedAt)) return 'Kasus CS sudah ditutup dan tidak dapat diserahkan ke RMA.';
    const candidates = entries.filter(([,item]) => item.row.Kondisi !== 'Good' && rejectedItems([item]).length > 0);
    if (next.items.length !== candidates.length) return 'Sertakan semua sisa barang bermasalah karena serah terima memindahkan seluruh order.';
    const used = new Set<string>();
    let capacity = 0;
    let allocated = 0;
    if (!next.items.length) return 'Pilih barang yang diserahkan ke RMA.';
    for (const item of next.items) {
      const entry = candidates.find(([key,source]) => !used.has(key) && (item.sourceKey ? key === item.sourceKey : source.row.SKU_ID === item.skuId) && source.row.SKU_ID === item.skuId && source.row.Kondisi === item.kondisi);
      if (!entry || item.qty !== 1) return 'Barang RMA harus sesuai barang bermasalah yang belum terganti; satu baris mewakili satu unit.';
      used.add(entry[0]);
      const available = uncoveredClaimAmount(entry[1]);
      if (!Number.isSafeInteger(item.subtotalEstimasi) || item.subtotalEstimasi < 0 || item.subtotalEstimasi > available) return 'Nilai barang RMA melebihi sisa kerugiannya.';
      if (item.sourceClaimAmount !== undefined && item.sourceClaimAmount !== Math.max(0,Number(entry[1].claimAmount)||0)) return 'Nilai sumber barang tidak sesuai catatan pemeriksaan.';
      if (item.marketplaceReservedAmount !== undefined && item.marketplaceReservedAmount !== Math.max(approvedMarketplaceAmount(entry[1]),Number(entry[1].settlementAmount)||0)) return 'Nominal marketplace yang dicadangkan tidak sesuai.';
      if (item.valuationPending && Number(entry[1].claimAmount) > 0) return 'Barang dengan nilai sumber diketahui tidak boleh ditandai belum dinilai.';
      capacity += available;
      allocated += item.subtotalEstimasi;
    }
    if (!Number.isSafeInteger(next.estimatedCompensation) || next.estimatedCompensation < 0 || next.estimatedCompensation > capacity || allocated !== next.estimatedCompensation) return 'Tuntutan RMA harus sama dengan alokasi barang dan tidak melebihi sisa kerugian.';
  }
  for (const [key, item] of Object.entries(incoming)) {
    if (key.startsWith('_') || !item?.row) continue;
    const old = previous[key];
    if (JSON.stringify(old) === JSON.stringify(item)) continue;
    const claimAmount=Math.max(0,Number(item.claimAmount)||0), approvedAmount=Math.max(0,Number(item.approvedAmount)||0), receivedAmount=Math.max(0,Number(item.settlementAmount)||0);
    if(!Number.isSafeInteger(claimAmount)||!Number.isSafeInteger(approvedAmount)||!Number.isSafeInteger(receivedAmount)||approvedAmount>claimAmount||receivedAmount>approvedAmount) return 'Nilai klaim, persetujuan, atau dana diterima tidak valid.';
    const superReopen = Boolean(allowAdminReopen && !old?.reopenedAt && item.reopenedAt && item.reopenedBySuperAccount?.trim() && item.reopenReason?.trim() && item.previousResolution);
    if (old?.closedAt && item.closedAt !== old.closedAt && !superReopen) return 'Kasus CS yang ditutup tidak boleh dibuka ulang lewat perubahan catatan.';
    if (superReopen) continue;
    if (item.closedAt && (!['APPROVED','PARTIAL','REJECTED'].includes(item.claimStatus) || !item.closureReason?.trim())) return 'Penutupan CS memerlukan keputusan akhir dan alasan penutupan.';
    if (item.claimStatus === 'REJECTED' && !item.csNotes?.trim()) return 'Catat alasan banding marketplace tidak berhasil.';
  }
  // Decisions remain immutable after transfer; actual receipts can still be recorded.
  for (const [key, old] of Object.entries(previous)) {
    if (key.startsWith('_') || !old?.row) continue;
    const order = normalizeOrderId(old.row.Order_ID);
    const owner = oldClaims.find(claim => normalizeOrderId(claim.orderId) === order && claim.stageStatus !== 'DIKEMBALIKAN_CS');
    if (!owner) continue;
    const next = incoming[key];
    const returned = nextClaims.find((claim:any) => claim.id === owner.id)?.stageStatus === 'DIKEMBALIKAN_CS';
    if (returned) continue;
    if (!next || ['claimStatus','approvedAmount','claimAmount','ticketNumber','channel'].some(field => JSON.stringify(old[field]) !== JSON.stringify(next[field]))) return 'Keputusan marketplace dikunci setelah serah terima. Pembayaran tetap dapat dicatat.';
    const received = Number(next.settlementAmount || 0);
    if (!Number.isSafeInteger(received) || received < 0 || received > approvedMarketplaceAmount(next)) return 'Dana marketplace tidak boleh melebihi nilai disetujui.';
  }
  return null;
}
