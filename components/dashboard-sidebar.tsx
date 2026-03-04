"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  FileText,
  TrendingUp,
  DollarSign,
  Percent,
  ArrowLeftRight,
  PieChart,
  Columns3,
  Users,
  Building2,
  Settings,
  LogOut,
  Home,
  Calendar,
  CalendarDays,
  ChevronDown,
  Check,
  ArrowLeft,
  Database,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDashboard } from "@/lib/contexts/DashboardContext";
import { API_ENDPOINTS } from "@/lib/constants";

interface Company {
  id: string;
  name: string;
}

interface DashboardSidebarProps {
  userRole: string;
  companyName: string;
}

export function DashboardSidebar({ userRole, companyName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Usa o Context para gerenciar estado
  const {
    viewMode,
    setViewMode,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedCompanyName,
    setSelectedCompanyName,
    availableYears,
    availableMonths,
    refreshData,
  } = useDashboard();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === "ADMIN";
  const isGestor = userRole === "GESTOR";
  const isEditor = userRole === "EDITOR" || isAdmin;

  // Buscar empresas do usuário
  useEffect(() => {
    const fetchCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const res = await fetch(API_ENDPOINTS.USER_COMPANIES);
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } catch (error) {
        console.error("Erro ao buscar empresas:", error);
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false);
      }
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCompany = (company: Company) => {
    setSelectedCompanyId(company.id);
    setSelectedCompanyName(company.name);
    setIsDropdownOpen(false);
    refreshData();
  };

  // Menu items for all users (Consulta, Editor, Admin)
  const analysisItems = [
    { href: "/dashboard", label: "Resumo Executivo", icon: Home },
    ...(isAdmin || isGestor ? [{ href: "/dashboard/comparativo", label: "Comparativo", icon: Columns3 }] : []),
    { href: "/dashboard/demonstracoes", label: "Demonstrações", icon: FileText },
    { href: "/dashboard/liquidez", label: "Índices de Liquidez", icon: TrendingUp },
    { href: "/dashboard/rentabilidade", label: "Rentabilidade", icon: DollarSign },
    { href: "/dashboard/endividamento", label: "Endividamento", icon: Percent },
    { href: "/dashboard/analise-horizontal", label: "Análise Horizontal", icon: ArrowLeftRight },
    { href: "/dashboard/analise-vertical", label: "Análise Vertical", icon: PieChart },
  ];

  // Menu items for Editor and Admin - Dados
  const dataManagementItems = [
    { href: "/admin/dados", label: "Gerenciar Dados", icon: Database },
  ];

  // Menu items for Admin only
  const adminItems = [
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/empresas", label: "Empresas", icon: Building2 },
    { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
  ];

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const handleChangeCompany = () => {
    router.push("/selecionar-empresa");
  };

  const handleViewModeChange = (mode: "anual" | "mensal") => {
    setViewMode(mode);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setIsYearDropdownOpen(false);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setIsMonthDropdownOpen(false);
  };

  const getMonthName = (monthValue: string) => {
    const month = availableMonths.find((m) => m.value === monthValue);
    return month?.label || monthValue;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#13161C] text-white flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="mb-4 flex justify-center">
          <Image src="/planning-logo.png" alt="Planning" width={150} height={42} className="h-16 w-auto" priority />
        </div>
        {/* Dropdown de Empresas */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition-all text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#C7CAD0]">Empresa Selecionada</p>
              <p className="text-sm font-medium truncate">{selectedCompanyName || companyName || "Selecione uma empresa"}</p>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-[#C7CAD0] transition-transform flex-shrink-0",
              isDropdownOpen && "rotate-180"
            )} />
          </button>

          {/* Dropdown Lista */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1C212A] border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
              {loadingCompanies ? (
                <div className="px-3 py-2 text-sm text-[#C7CAD0]">Carregando...</div>
              ) : companies.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#C7CAD0]">Nenhuma empresa disponível</div>
              ) : (
                companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleSelectCompany(company)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors text-[#C7CAD0]",
                      company.id === selectedCompanyId && "bg-[#08C97D]/25 text-white"
                    )}
                  >
                    <span className="truncate">{company.name}</span>
                    {company.id === selectedCompanyId && (
                      <Check className="w-4 h-4 text-[#08C97D] flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Botão Voltar à Seleção */}
        <button
          onClick={handleChangeCompany}
          className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-sm text-[#C7CAD0] hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Seleção</span>
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs text-[#C7CAD0] uppercase font-medium mb-2 px-2">Visão</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => handleViewModeChange("anual")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
              viewMode === "anual"
                ? "bg-[#08C97D] text-[#13161C]"
                : "text-[#C7CAD0] hover:bg-white/10"
            )}
          >
            <Calendar className="w-4 h-4" />
            Anual
          </button>
          <button
            onClick={() => handleViewModeChange("mensal")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
              viewMode === "mensal"
                ? "bg-[#08C97D] text-[#13161C]"
                : "text-[#C7CAD0] hover:bg-white/10"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Mensal
          </button>
        </div>
        
        {/* Seletor de Ano */}
        <div className="relative mb-2" ref={yearDropdownRef}>
          <button
            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-sm"
          >
            <span className="text-[#C7CAD0]">Ano:</span>
            <span className="font-medium">{selectedYear}</span>
            <ChevronDown className={cn(
              "w-4 h-4 text-[#C7CAD0] transition-transform",
              isYearDropdownOpen && "rotate-180"
            )} />
          </button>
          {isYearDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1C212A] border border-white/10 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => handleYearChange(year)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors text-[#C7CAD0]",
                    year === selectedYear && "bg-[#08C97D]/25 text-white"
                  )}
                >
                  <span>{year}</span>
                  {year === selectedYear && <Check className="w-4 h-4 text-[#08C97D]" />}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Seletor de Mês (apenas para visão mensal) */}
        {viewMode === "mensal" && (
          <div className="relative" ref={monthDropdownRef}>
            <button
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-sm"
            >
                <span className="text-[#C7CAD0]">Mês:</span>
              <span className="font-medium">{getMonthName(selectedMonth)}</span>
              <ChevronDown className={cn(
                  "w-4 h-4 text-[#C7CAD0] transition-transform",
                isMonthDropdownOpen && "rotate-180"
              )} />
            </button>
            {isMonthDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1C212A] border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {availableMonths.map((month) => (
                  <button
                    key={month.value}
                    onClick={() => handleMonthChange(month.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors text-[#C7CAD0]",
                        month.value === selectedMonth && "bg-[#08C97D]/25 text-white"
                    )}
                  >
                    <span>{month.label}</span>
                      {month.value === selectedMonth && <Check className="w-4 h-4 text-[#08C97D]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Analysis Section */}
        <div className="px-4 mb-4">
          <p className="text-xs text-[#C7CAD0] uppercase font-medium mb-2 px-2">Análises</p>
          <ul className="space-y-1">
            {analysisItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                      isActive
                        ? "bg-[#08C97D] text-[#13161C]"
                        : "text-[#C7CAD0] hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Data Management Section (Editor & Admin) */}
        {isEditor && (
          <div className="px-4 mb-4">
            <p className="text-xs text-[#C7CAD0] uppercase font-medium mb-2 px-2">Dados</p>
            <ul className="space-y-1">
              {dataManagementItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                        isActive
                          ? "bg-[#08C97D] text-[#13161C]"
                          : "text-[#C7CAD0] hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <div className="px-4 mb-4">
            <p className="text-xs text-[#C7CAD0] uppercase font-medium mb-2 px-2">Administração</p>
            <ul className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                        isActive
                          ? "bg-[#08C97D] text-[#13161C]"
                          : "text-[#C7CAD0] hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="bg-white/10 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-[#C7CAD0]">Nível de Acesso</p>
          <p className="text-sm font-medium">{userRole}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </aside>
  );
}
