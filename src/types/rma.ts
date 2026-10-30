import { ProcessedReturnRow } from '../processor';
import type { ClaimChannel } from '../components/DisputeClaimsView';

export type RmaStageStatus =
  | 'DITERIMA_CS'
  | 'DIALIHKAN_KE_RMA'
  | 'DITERIMA_RMA' | 'BUKTI_KURANG' | 'LAYAK_LOGISTIK' | 'TIDAK_LAYAK'
  | 'DRAF_LOGISTIK' | 'DIAJUKAN_LOGISTIK' | 'MENUNGGU_LOGISTIK' | 'HASIL_LOGISTIK'
  | 'INVESTIGASI'
  | 'SELESAI';

export const RMA_STAGE_LABELS: Record<
  RmaStageStatus,
  { labelId: string; labelEn: string; badgeColor: string; description: string }
> = {
  DITERIMA_CS: {
    labelId: 'Pencatatan lama (CS)',
    labelEn: 'Received by CS',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Kasus klaim tercatat di CS dan telah diterima untuk dipersiapkan eskalasinya.'
  },
  DIALIHKAN_KE_RMA: {
    labelId: 'Menunggu penerimaan RMA',
    labelEn: 'Transferred to RMA Team',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    description: 'Tanggung jawab penyelesaian klaim resmi dialihkan dari CS ke Tim RMA.'
  },
  DITERIMA_RMA: { labelId: 'Pemeriksaan bukti RMA', labelEn: 'RMA review', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'RMA menerima kasus dan memeriksa dasar klaim serta bukti.' },
  BUKTI_KURANG: { labelId: 'Menunggu bukti dari CS', labelEn: 'Awaiting CS evidence', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'RMA meminta kelengkapan kepada CS. Kasus tetap milik RMA.' },
  LAYAK_LOGISTIK: { labelId: 'Layak banding logistik', labelEn: 'Eligible for logistics appeal', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'Dasar klaim dan bukti telah diperiksa RMA.' },
  TIDAK_LAYAK: { labelId: 'Ditutup — tidak layak logistik', labelEn: 'Closed — not eligible', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'Ditutup dengan alasan; banding marketplace tidak dibuka ulang.' },
  DRAF_LOGISTIK: { labelId: 'Draf banding logistik', labelEn: 'Logistics draft', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'Tim menyiapkan dokumen banding logistik.' },
  DIAJUKAN_LOGISTIK: { labelId: 'Diajukan ke logistik', labelEn: 'Submitted to carrier', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'Banding telah diajukan di luar aplikasi. Catat nomor tiket.' },
  MENUNGGU_LOGISTIK: { labelId: 'Menunggu keputusan logistik', labelEn: 'Awaiting carrier decision', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'Tim menunggu keputusan dari pihak logistik.' },
  HASIL_LOGISTIK: { labelId: 'Hasil logistik / pembayaran', labelEn: 'Carrier outcome / payment', badgeColor: 'bg-blue-50 text-blue-800 border-blue-200', description: 'Catat keputusan, nominal disetujui, dan uang diterima secara terpisah.' },
  INVESTIGASI: {
    labelId: 'Banding ke logistik',
    labelEn: 'Logistics appeal',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    description: 'Tim RMA memeriksa bukti dan mengajukan banding ke logistik setelah marketplace menolak.'
  },
  SELESAI: {
    labelId: 'Selesai',
    labelEn: 'Resolved / Completed',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    description: 'Klaim logistik telah diselesaikan dengan penetapan realisasi ganti rugi.'
  }
};

export interface RmaClaimItem {
  skuId: string;
  namaBarang: string;
  qty: number;
  kondisi: string;
  hargaSatuan: number;
  subtotalEstimasi: number;
}

export interface RmaClaimRecord {
  id: string; // rma_<orderId>_<timestamp>
  orderId: string;
  awb?: string;
  channel: ClaimChannel; // Logistics target; legacy records may contain a marketplace.
  logisticsName?: string;
  marketplaceChannel?: ClaimChannel;
  marketplaceRejectionReason?: string;
  marketplaceDecisionEvidence?: string;
  marketplaceTicket?: string;
  stageStatus: RmaStageStatus;
  
  // Rincian barang & estimasi ganti rugi
  items: RmaClaimItem[];
  estimatedCompensation: number; // Estimasi nilai ganti rugi (wajib saat CS meneruskan)
  approvedAmount?: number;
  paymentStatus?: 'NOT_APPLICABLE' | 'WAITING' | 'PARTIAL' | 'RECEIVED';
  paymentReference?: string;
  eligibility?: 'PENDING' | 'NEEDS_EVIDENCE' | 'ELIGIBLE' | 'INELIGIBLE';
  eligibilityReason?: string;
  evidenceReference?: string;
  logisticsTicket?: string;
  logisticsOutcome?: 'APPROVED' | 'PARTIAL' | 'REJECTED';
  closureReason?: string;
  acceptedAt?: string;
  history?: Array<{at: string; by: string; from: string; to: string; note: string}>;
  approvedCompensation?: number;  // Nilai pencairan ganti rugi aktual yang disetujui logistik (saat selesai)
  
  // Serah terima dari CS
  csNotes: string;               // Alasan pelimpahan/catatan kendala dari CS
  forwardedBy: string;           // Operator / Akun CS yang meneruskan
  forwardedAt: string;           // Timestamp serah terima (ISO string)
  
  // Investigasi & Penanganan RMA
  rmaInvestigator?: string;      // Petugas RMA yang menangani
  investigationNotes?: string;   // Catatan hasil investigasi fisik gudang & logistik
  resolutionDate?: string;       // Tanggal selesai
  resolutionNote?: string;       // Catatan kesimpulan akhir klaim logistik
  
  // Data pelengkap unboxing
  videoTimestamp?: string;
  namaFileVideo?: string;
  linkVideo?: string;
  operatorId?: string;
  waktuProses?: string;
  
  updatedAt: string;
}
