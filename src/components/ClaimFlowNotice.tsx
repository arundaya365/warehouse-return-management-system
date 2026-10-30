import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export function ClaimFlowNotice({stage}: {stage: 'marketplace' | 'logistics'}) {
  const {isEn} = useLanguage();
  return <aside className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs leading-relaxed text-teal-950" aria-label={isEn ? 'Claim workflow' : 'Alur banding'}>
    <strong>{stage === 'marketplace' ? (isEn ? 'CS · Marketplace appeal' : 'CS · Banding marketplace') : (isEn ? 'RMA · Logistics appeal' : 'RMA · Banding logistik')}</strong>
    <p className="mt-1">{isEn ? 'CS records the marketplace appeal first. After a failed or partial result, RMA accepts and reviews the remaining claim and its evidence before a logistics appeal. Approved amounts and payments received are separate.' : 'CS mengajukan banding ke marketplace terlebih dahulu. Jika ditolak atau sebagian tidak dikabulkan, RMA menerima dan memeriksa bukti sebelum menetapkan kelayakan banding logistik. Nilai disetujui dan dana diterima dicatat terpisah.'}</p>
    <p className="mt-1 text-teal-800">{isEn ? 'This app records appeals and prepares evidence. It does not submit appeals automatically to a marketplace or carrier.' : 'Aplikasi mencatat banding dan menyiapkan bukti; pengajuan ke marketplace atau logistik dilakukan oleh tim, bukan dikirim otomatis dari aplikasi.'}</p>
  </aside>;
}
