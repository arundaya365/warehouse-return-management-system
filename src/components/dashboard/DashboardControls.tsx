import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
export const DashboardButton=React.forwardRef<HTMLButtonElement,React.ButtonHTMLAttributes<HTMLButtonElement>>(function DashboardButton({className='',onClick,...props},ref){return <button ref={ref} type="button" className={`dashboard-button ${className}`} onClick={onClick} {...props}/>;});
export function DashboardState({state,loading,hasData,onRetry}:{state:string;loading:boolean;hasData:boolean;onRetry?:()=>Promise<unknown>}){
 const [retrying,setRetrying]=useState(false);const [failed,setFailed]=useState(false);
 useEffect(()=>{if(state==='synced')setFailed(false);},[state]);
 const retry=async()=>{setRetrying(true);setFailed(false);try{await onRetry?.();}catch{setFailed(true);}finally{setRetrying(false);}};
 if(state==='error'||state==='offline'||failed)return <aside className="dashboard-sync-toast dashboard-sync-toast-warning" role="status">{state==='offline'?<WifiOff size={18}/>:<AlertCircle size={18}/>}<span>{state==='offline'?'Tidak terhubung.':'Sinkronisasi gagal.'} {hasData?'Data tersimpan ditampilkan dan mungkin belum terbaru.':'Data belum tersedia. Coba sinkronisasi kembali.'}</span>{onRetry&&<DashboardButton onClick={retry} disabled={retrying}><RefreshCw size={16}/>{retrying?'Mencoba lagi…':'Coba Lagi'}</DashboardButton>}</aside>;
 if(state==='syncing'||loading)return <aside className="dashboard-sync-toast" role="status" aria-live="polite"><RefreshCw size={16} className="dashboard-spinner"/><span>{loading?'Memuat data retur…':'Memperbarui data…'}</span></aside>;
 return null;
}
