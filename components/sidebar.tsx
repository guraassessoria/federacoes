'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Droplets, 
  TrendingUp, 
  Scale, 
  ArrowLeftRight, 
  BarChart3,
  Trophy,
  Building2,
  ChevronDown,
  ArrowLeft,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
}

const navItems = [
  { href: '/dashboard', label: 'Resumo Executivo', icon: LayoutDashboard },
  { href: '/dashboard/demonstracoes', label: 'Demonstrações Financeiras', icon: FileSpreadsheet },
  { href: '/dashboard/liquidez', label: 'Índices de Liquidez', icon: Droplets },
  { href: '/dashboard/rentabilidade', label: 'Índices de Rentabilidade', icon: TrendingUp },
  { href: '/dashboard/endividamento', label: 'Índices de Endividamento', icon: Scale },
  { href: '/dashboard/analise-horizontal', label: 'Análise Horizontal', icon: ArrowLeftRight },
  { href: '/dashboard/analise-vertical', label: 'Análise Vertical', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('Selecione uma empresa');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/user/companies');
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } catch (error) {
        console.error('Erro ao buscar empresas:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCompanies();

    // Carregar empresa selecionada do localStorage
    const storedId = localStorage.getItem('selectedCompany');
    const storedName = localStorage.getItem('selectedCompanyName');
    if (storedId) setSelectedCompanyId(storedId);
    if (storedName) setSelectedCompanyName(storedName);
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCompany = (company: Company) => {
    setSelectedCompanyId(company.id);
    setSelectedCompanyName(company.name);
    localStorage.setItem('selectedCompany', company.id);
    localStorage.setItem('selectedCompanyName', company.name);
    setIsDropdownOpen(false);
    // Recarregar a página para atualizar os dados
    window.location.reload();
  };

  const handleBackToSelection = () => {
    router.push('/selecionar-empresa');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-xl z-50">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Dashboard</h1>
            <p className="text-xs text-slate-400">Financeiro</p>
          </div>
        </div>

        {/* Seletor de Empresa */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm truncate">{selectedCompanyName}</span>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-slate-400 transition-transform flex-shrink-0",
              isDropdownOpen && "rotate-180"
            )} />
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
              {loading ? (
                <div className="px-3 py-2 text-sm text-slate-400">Carregando...</div>
              ) : companies.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">Nenhuma empresa disponível</div>
              ) : (
                companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleSelectCompany(company)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-700 transition-colors",
                      company.id === selectedCompanyId && "bg-emerald-600/20 text-emerald-400"
                    )}
                  >
                    <span className="truncate">{company.name}</span>
                    {company.id === selectedCompanyId && (
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Botão Trocar Empresa */}
        <button
          onClick={handleBackToSelection}
          className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Seleção</span>
        </button>
      </div>
      
      <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 text-center">
          <p>Dados: 2023-2025</p>
          <p>Valores em R$ mil</p>
        </div>
      </div>
    </aside>
  );
}
