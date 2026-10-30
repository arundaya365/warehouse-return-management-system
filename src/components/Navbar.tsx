import React, {useEffect,useState} from 'react';
import {Package,Video,FileSpreadsheet,FileText,ShieldAlert,LayoutDashboard,Users,Truck,HardDrive,Cloud,RefreshCw,Menu,ChevronDown,LogOut,UserRound} from 'lucide-react';
import type {User as FirebaseUser} from 'firebase/auth';
import {useLanguage} from '../context/LanguageContext';
import {useAccount,ROLE_DEFINITIONS} from '../context/AccountContext';
import {syncService,type SyncState} from '../services/dataSyncService';
export type AppNavTab='dashboard'|'station'|'reports'|'disputes'|'rma'|'database'|'accounts';
export interface CsDisputeStats {activeCount:number;pendingCount:number;submittedCount:number;approvedCount:number;rejectedCount:number;forwardedRmaCount:number;}
interface NavbarProps {activeTab:AppNavTab;setActiveTab:(tab:AppNavTab)=>void;reportCount:number;damageCount?:number;rmaCount?:number;csDisputeStats?:CsDisputeStats;masterCount:number;operatorId:string;googleUser?:FirebaseUser|null;}
export const Navbar:React.FC<NavbarProps>=({activeTab,setActiveTab,reportCount,damageCount=0,rmaCount=0,masterCount})=>{
 const {currentUser,companyName,hasPermission,setIsLoginModalOpen,logoutOperator}=useAccount();
 const {language,setLanguage}=useLanguage();
 useEffect(()=>{if(language!=='id')setLanguage('id');},[language]);
 const [sync,setSync]=useState<SyncState>('idle');
 useEffect(()=>syncService.subscribeStatus(state=>setSync(old=>state==='syncing'&&old==='synced'?old:state)),[]);
 useEffect(()=>{
  const close=(event:PointerEvent|KeyboardEvent)=>document.querySelectorAll<HTMLDetailsElement>('.warehouse-action-menu[open]').forEach(menu=>{
   if(event instanceof KeyboardEvent){if(event.key!=='Escape')return;menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus();}
   else if(!menu.contains(event.target as Node))menu.open=false;
  });
  const position=(event:Event)=>{const menu=event.target;if(!(menu instanceof HTMLDetailsElement)||!menu.matches('.warehouse-action-menu')||!menu.open)return;menu.removeAttribute('data-side');const panel=menu.querySelector<HTMLElement>('.warehouse-menu-panel');if(panel&&panel.getBoundingClientRect().bottom>window.innerHeight-12&&menu.getBoundingClientRect().top>panel.offsetHeight+12)menu.dataset.side='top';};
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);document.addEventListener('toggle',position,true);
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close);document.removeEventListener('toggle',position,true);};
 },[]);
 const local=import.meta.env.VITE_LOCAL_TRIAL==='true';
 const items=[
  {id:'dashboard',label:'Dashboard',icon:LayoutDashboard,allowed:hasPermission('canAccessDashboard'),primary:true},
  {id:'station',label:'Unboxing',icon:Video,allowed:hasPermission('canAccessStation'),primary:true},
  {id:'reports',label:'Laporan',icon:FileText,allowed:hasPermission('canAccessReports'),primary:true,count:reportCount},
  {id:'rma',label:'Klaim RMA',icon:Truck,allowed:hasPermission('canAccessRma'),primary:true,count:rmaCount},
  {id:'disputes',label:'Klaim CS',icon:ShieldAlert,allowed:hasPermission('canAccessDisputes'),primary:false,count:damageCount},
  {id:'database',label:'Data SKU',icon:FileSpreadsheet,allowed:hasPermission('canAccessDatabase'),primary:false,count:masterCount},
  {id:'accounts',label:'Kelola akun',icon:Users,allowed:hasPermission('canManageUsers')||currentUser.role==='SUPER_ADMIN',primary:false}
 ].filter(item=>item.allowed);
 const activate=(event:React.MouseEvent<HTMLElement>,id:string)=>{setActiveTab(id as AppNavTab);const details=event.currentTarget.closest('details');if(details){details.open=false;details.querySelector<HTMLElement>('summary')?.focus();}};
 const link=(item:typeof items[number])=><button type="button" key={item.id} aria-current={activeTab===item.id?'page':undefined} onClick={event=>activate(event,item.id)}><item.icon size={17} aria-hidden="true"/><span>{item.label}</span>{!!item.count&&<span className="saas-nav-count">{item.count}</span>}</button>;
 const unavailable=sync==='offline'||sync==='error';
 return <header className="saas-navbar"><div className="saas-navbar-inner">
  <div className="saas-brand"><span className="saas-brand-mark"><Package size={23} aria-hidden="true"/></span><div><strong>unboxin.id</strong><span>{companyName||'Manajemen retur gudang'}</span></div></div>

  <div className="saas-account-actions"><details className="warehouse-action-menu saas-mobile-menu"><summary aria-label="Menu navigasi"><Menu size={20} aria-hidden="true"/><span>Menu</span></summary><nav className="warehouse-menu-panel" aria-label="Navigasi perangkat kecil">{items.map(link)}</nav></details>
   <details className="warehouse-action-menu saas-account"><summary aria-label={`Menu akun ${currentUser.fullName}`}><span className="saas-avatar" aria-hidden="true">{currentUser.fullName.split(' ').map(name=>name[0]).slice(0,2).join('')}</span><span className="saas-account-name">{currentUser.fullName}</span><ChevronDown size={14} aria-hidden="true"/></summary><div className="warehouse-menu-panel"><p className="saas-account-info"><strong>{currentUser.fullName}</strong><span>{ROLE_DEFINITIONS[currentUser.role]?.labelId}</span></p><button type="button" onClick={event=>{setIsLoginModalOpen(true);event.currentTarget.closest('details')?.removeAttribute('open');}}><UserRound size={16} aria-hidden="true"/>Ganti operator</button><button type="button" className="warehouse-danger" onClick={event=>{logoutOperator();event.currentTarget.closest('details')?.removeAttribute('open');}}><LogOut size={16} aria-hidden="true"/>Keluar</button></div></details>
  </div></div>
  <nav className="saas-desktop-nav" aria-label="Navigasi utama">{items.map(link)}</nav>
  <div className="saas-status"><span>{local?<HardDrive size={12} aria-hidden="true"/>:<Cloud size={12} aria-hidden="true"/>}{local?'Penyimpanan laptop':'Penyimpanan server'}</span><span role="status" className={unavailable?'saas-offline':''}><i aria-hidden="true"/>{unavailable?'Koneksi terputus':sync==='synced'?'Terhubung ke server':sync==='syncing'?'Memeriksa koneksi':'Menunggu koneksi'}</span>{unavailable&&<button type="button" onClick={()=>void syncService.syncPull()}><RefreshCw size={12} aria-hidden="true"/>Coba lagi</button>}</div></header>;
};
