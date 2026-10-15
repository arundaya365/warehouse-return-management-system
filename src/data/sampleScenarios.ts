import { UnboxingSessionInput } from '../processor';

export interface ScenarioPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  payload: UnboxingSessionInput;
}

export const SAMPLE_SCENARIOS: ScenarioPreset[] = [
  {
    id: 'scenario-multi-condition',
    title: 'Skenario 1: Retur Multi-Kondisi (Kerusakan Produk & Dus)',
    badge: 'Kombinasi Kondisi',
    description: 'Order 3 barang: 1 mulus, 1 kemasan penyok parah, 1 produk pecah retak berdasarkan rekaman suara operator.',
    payload: {
      Operator_ID: 'OP-WH-042',
      Order_ID: 'ORD-ID-9823441',
      Video_Timestamp: '2026-10-07 14:20:15',
      Link_Video: 'https://drive.google.com/file/d/1vA8kL9mNpQrStUvWxYz-demo1/view',
      audio_transcript: 'Paket dibuka, untuk headset gaming kotaknya penyok parah dari ekspedisi tapi unit masih aman. Kaos distro kondisinya mulus bagus. Sedangkan mouse wireless layarnya retak dan tombol klik patah.',
      Expected_SKUs: [
        {
          SKU_ID: 'SKU-ELEC-001',
          Nama_Barang: 'Headset Gaming 7.1 Surround RGB'
        },
        {
          SKU_ID: 'SKU-APPR-102',
          Nama_Barang: 'Kaos Distro Oversize Cotton Combed Black'
        },
        {
          SKU_ID: 'SKU-ELEC-003',
          Nama_Barang: 'Mouse Wireless Ergonomic Silent Click'
        }
      ],
      Scanned_SKUs: [
        {
          SKU_ID: 'SKU-ELEC-001'
        },
        {
          SKU_ID: 'SKU-APPR-102'
        },
        {
          SKU_ID: 'SKU-ELEC-003'
        }
      ]
    }
  },
  {
    id: 'scenario-missing-item',
    title: 'Skenario 2: Barang Hilang / Tidak Di-scan (Missing Rule)',
    badge: 'Aturan Missing Otomatis',
    description: 'Order berisi 3 barang, namun operator hanya menemukan & men-scan 2 barang. Aturan wajib #2 otomatis menandai barang ketiga sebagai "Missing".',
    payload: {
      Operator_ID: 'OP-WH-018',
      Order_ID: 'TOKOPEDIA-88492019',
      Video_Timestamp: '2026-10-07 09:12:44',
      Link_Video: 'https://drive.google.com/file/d/1vB9xM0oPqRsTuVwXyZ1-demo2/view',
      audio_transcript: 'Dus luar sobek bekas lakban dibuka. Jam tangan smartwatch ada dan mulus. Strap tali cadangan ada. Tapi adaptor charger tidak ada di dalam kotak, kotak aksesoris kosong.',
      Expected_SKUs: [
        {
          SKU_ID: 'SKU-WATCH-991',
          Nama_Barang: 'Smartwatch AMOLED Display GPS'
        },
        {
          SKU_ID: 'SKU-STRAP-02',
          Nama_Barang: 'Strap Silikon Pengganti 22mm Navy'
        },
        {
          SKU_ID: 'SKU-ADAPT-33',
          Nama_Barang: 'Adaptor Fast Charger 20W USB-C'
        }
      ],
      Scanned_SKUs: [
        {
          SKU_ID: 'SKU-WATCH-991'
        },
        {
          SKU_ID: 'SKU-STRAP-02'
        }
        // Catatan: SKU-ADAPT-33 sengaja TIDAK di-scan untuk memicu Aturan #2 (Missing)
      ]
    }
  },
  {
    id: 'scenario-unexpected-item',
    title: 'Skenario 3: Ada Barang Nyasar / Tak Terdaftar (Unexpected)',
    badge: 'Barang Unexpected',
    description: 'Di dalam paket retur terdapat barang lain yang tidak ada dalam daftar pesanan pelanggan (salah retur / barang nyasar).',
    payload: {
      Operator_ID: 'OP-WH-007',
      Order_ID: 'TIKTOK-SHOP-552140',
      Video_Timestamp: '2026-10-07 11:35:00',
      Link_Video: 'https://drive.google.com/file/d/1vC1yN2pQrStUvWxYz02-demo3/view',
      audio_transcript: 'Sepatu sneakers original ada mulus. Tapi di dalam kardus ada botol minum termos yang bukan barang dari toko kita.',
      Expected_SKUs: [
        {
          SKU_ID: 'SKU-SHOE-772',
          Nama_Barang: 'Sepatu Sneakers Pria Running White Size 42'
        }
      ],
      Scanned_SKUs: [
        {
          SKU_ID: 'SKU-SHOE-772'
        },
        {
          SKU_ID: 'SKU-UNKNOWN-999',
          Nama_Barang: 'Botol Tumbler Stainless Steel Merah',
          Catatan_Tambahan: 'Ditemukan di dalam paket retur, bukan produk toko kita'
        }
      ]
    }
  },
  {
    id: 'scenario-damage-packaging',
    title: 'Skenario 4: Kerusakan Kemasan Ekspedisi Parah',
    badge: 'Damage Packaging',
    description: 'Dus basah dan penyok parah terkena hujan saat transit logistik, isi barang kosmetik dicek operator.',
    payload: {
      Operator_ID: 'OP-WH-029',
      Order_ID: 'SHOPEE-66719230',
      Video_Timestamp: '2026-10-07 16:45:22',
      Link_Video: 'https://drive.google.com/file/d/1vD2zO3qRsTuVwXyZ03-demo4/view',
      audio_transcript: 'Kardus luar basah kuyup dan dus penyok parah remuk. Tapi botol serum dan toner di dalam bubble wrap masih utuh tidak pecah.',
      Expected_SKUs: [
        {
          SKU_ID: 'SKU-BEAU-11',
          Nama_Barang: 'Serum Wajah Vitamin C 30ml'
        },
        {
          SKU_ID: 'SKU-BEAU-12',
          Nama_Barang: 'Hydrating Face Toner 100ml'
        }
      ],
      Scanned_SKUs: [
        {
          SKU_ID: 'SKU-BEAU-11'
        },
        {
          SKU_ID: 'SKU-BEAU-12'
        }
      ]
    }
  }
];
