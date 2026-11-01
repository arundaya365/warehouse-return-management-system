export type StoreMarketplace = 'Shopee' | 'Tokopedia' | 'TikTok Shop' | 'Lazada' | 'Blibli' | 'Lainnya';

export interface StoreProfile {
  id: string;
  name: string;
  marketplace: StoreMarketplace;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  note?: string;
  createdAt: string;
  updatedAt: string;
}
