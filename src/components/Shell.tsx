import type { ReactNode } from 'react';
import { BarChart3, BookOpen, HardHat, LogOut, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { api, clearAccessToken } from '../api';
import type { User } from '../types';

export default function Shell({user,onLogout,children}:{user:User;onLogout:()=>void;children:ReactNode}){
  async function logout(){try{await api('/auth/logout',{method:'POST'})}finally{await clearAccessToken();onLogout()}}
  return <div className="app-shell"><aside><div className="brand"><div className="brand-mark"><ShieldCheck/></div><div><strong>Certifica Vale</strong><span>Inteligência de desempenho</span></div></div><nav><NavLink to="/teorico"><BookOpen/>Teórico</NavLink><NavLink to="/pratico"><HardHat/>Prático</NavLink><NavLink to="/gap"><BarChart3/>Análise de GAP</NavLink>{user.role==='admin'&&<><NavLink to="/atualizacoes"><RefreshCw/>Atualizações</NavLink><NavLink to="/usuarios"><Users/>Usuários</NavLink></>}</nav><div className="user-box"><div className="avatar">{user.name.slice(0,2).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.role==='admin'?'Administrador':'Visualizador'}</span></div><button onClick={logout} title="Sair"><LogOut/></button></div></aside><main>{children}</main></div>
}
