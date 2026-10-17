import { ProcessedReturnRow } from '../processor';
import { ClaimChannel } from '../components/DisputeClaimsView';

export type RmaStageStatus =
  | 'DITERIMA_CS'
  | 'DIALIHKAN_KE_RMA'
  | 'INVESTIGASI'
  | 'SELESAI';

export const RMA_STAGE_LABELS: Record<
  RmaStageStatus,
  { labelId: string; labelEn: string; badgeColor: string; description: string }
> = {
  DITERIMA_CS: {
    labelId: 'Diterima CS',
    labelEn: 'Received by CS',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Kasus klaim tercatat di CS dan telah diterima untuk dipersiapkan eskalasinya.'
  },
  DIALIHKAN_KE_RMA: {
    labelId: 'Case Dialihkan ke Team RMA',
    labelEn: 'Transferred to RMA Team',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    description: 'Tanggung jawab penyelesaian klaim resmi dialihkan dari CS ke Tim RMA.'
  },
  INVESTIGASI: {
    labelId: 'Investigasi',
    labelEn: 'Under Investigation',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    description: 'Tim RMA sedang menginvestigasi fisik barang, rekaman unboxing, dan log ekspedisi.'
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
  channel: ClaimChannel;
  stageStatus: RmaStageStatus;
  
  // Rincian barang & estimasi ganti rugi
  items: RmaClaimItem[];
  estimatedCompensation: number; // Estimasi nilai ganti rugi (wajib saat CS meneruskan)
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
