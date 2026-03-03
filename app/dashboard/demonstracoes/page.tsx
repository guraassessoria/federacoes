'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, ChevronDown, ChevronRight, Download, Loader2, FileBarChart, X, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/data';
import CustomBarChart from '@/components/charts/bar-chart';
import { API_ENDPOINTS } from '@/lib/constants';
import { useDashboard } from '@/lib/contexts/DashboardContext';
import { ordenarArvoreDreReceitaBrutaPrimeiro, ordenarDreReceitaBrutaPrimeiro } from '@/lib/services/drePresentation';

// Interface para conta hierárquica (dados brutos do balancete)
interface HierarchicalAccount {
  codigo: string;
  descricao: string;
  valor: number;
  nivel: number;
  children?: HierarchicalAccount[];
}

// Interface para conta da estrutura base (de-para)
interface ContaComValor {
  codigo: string;
  descricao: string;
  codigoSuperior: string | null;
  nivel: number;
  nivelVisualizacao: number;
  valor: number;
  children?: ContaComValor[];
}

// Interface para DRE hierárquica
interface HierarchicalDRE {
  receitas: HierarchicalAccount[];
  custos: HierarchicalAccount[];
  resultados: Record<string, number>;
  total: number;
}

// Interface para BP hierárquico
interface HierarchicalBP {
  ativo: HierarchicalAccount[];
  passivo: HierarchicalAccount[];
  patrimonioLiquido: HierarchicalAccount[];
  totalAtivo: number;
  totalPassivo: number;
  totalPL: number;
}

// Interface para dados financeiros da API
interface FinancialApiData {
  bp?: {
    ativoCirculante?: Record<string, number>;
    ativoNaoCirculante?: Record<string, number>;
    passivoCirculante?: Record<string, number>;
    passivoNaoCirculante?: Record<string, number>;
    patrimonioLiquido?: Record<string, number>;
    totalAtivo?: number;
    totalPassivo?: number;
  };
  dre?: {
    receitas?: Record<string, number>;
    custos?: Record<string, number>;
    despesas?: Record<string, number>;
    resultados?: Record<string, number>;
    total?: number;
  };
  // Dados da estrutura base (de-para) - PRIORIDADE
  estruturaDRE?: ContaComValor[];
  estruturaBP?: ContaComValor[];
  // Totais calculados (integração DRE no BP)
  resultadoDRE?: number;
  totalPassivoPL?: number;
  // Dados hierárquicos brutos (fallback)
  hierarchicalDRE?: HierarchicalDRE;
  hierarchicalBP?: HierarchicalBP;
}

type TabType = 'bp' | 'dre' | 'dfc' | 'dmpl' | 'dva';

interface UserCompany {
  id: string;
  name: string;
  cnpj: string | null;
  role: string;
}

// Anos disponíveis
const anosDisponiveis = ['2023', '2024', '2025'];
const MONTHS = [
  { value: '01', label: 'JAN' },
  { value: '02', label: 'FEV' },
  { value: '03', label: 'MAR' },
  { value: '04', label: 'ABR' },
  { value: '05', label: 'MAI' },
  { value: '06', label: 'JUN' },
  { value: '07', label: 'JUL' },
  { value: '08', label: 'AGO' },
  { value: '09', label: 'SET' },
  { value: '10', label: 'OUT' },
  { value: '11', label: 'NOV' },
  { value: '12', label: 'DEZ' },
];

// Todas as federações do sistema (com dados disponíveis na API)
// Federações derivadas das empresas do usuário (não mais lista estática)

const bpGroups = [
  { title: 'Ativo Circulante', keys: ['Total Disponibilidades', 'Total Contas a Receber', 'Total Estoques', 'Total Ativo Circulante'], total: 'Total Ativo Circulante' },
  { title: 'Ativo Nao Circulante', keys: ['Total Imobilizado Liquido', 'Total Intangivel', 'Total Ativo Nao Circulante'], total: 'Total Ativo Nao Circulante' },
  { title: 'Passivo Circulante', keys: ['Fornecedores', 'Emprestimos Bancarios CP', 'Total Passivo Circulante'], total: 'Total Passivo Circulante' },
  { title: 'Passivo Nao Circulante', keys: ['Emprestimos Bancarios LP', 'Financiamentos LP', 'Total Passivo Nao Circulante'], total: 'Total Passivo Nao Circulante' },
  { title: 'Patrimonio Liquido', keys: ['Capital Social', 'Reserva Legal', 'Superavits Acumulados', 'Total Patrimonio Liquido'], total: 'Total Patrimonio Liquido' }
];

const dreGroups = [
  { title: 'Receitas Operacionais', keys: ['Receitas de Competicoes', 'Receitas de Repasses', 'Receitas de Convenios e Parcerias', 'Outras Receitas Operacionais', 'Total Receitas Operacionais'], total: 'Total Receitas Operacionais' },
  { title: 'Custos', keys: ['Custos com Competicoes', 'Custos com Desenvolvimento do Futebol', 'Custos com Infraestrutura Esportiva', 'Total Custos'], total: 'Total Custos' },
  { title: 'Despesas Operacionais', keys: ['Despesas com Pessoal', 'Despesas Administrativas', 'Despesas Comerciais e Marketing', 'Outras Despesas Operacionais', 'Total Despesas Operacionais'], total: 'Total Despesas Operacionais' },
  { title: 'Resultados', keys: ['Resultado Operacional', 'Resultado Financeiro', 'Resultado Nao Operacional', 'Resultado Liquido'], total: 'Resultado Liquido' }
];

const dfcGroups = [
  { title: 'Atividades Operacionais', keys: ['Resultado do Periodo', 'Ajustes de Depreciacoes', 'Ajustes de Provisoes', 'Variacao de Contas a Receber', 'Variacao de Estoques', 'Variacao de Fornecedores', 'Total Atividades Operacionais'], total: 'Total Atividades Operacionais' },
  { title: 'Atividades de Investimento', keys: ['Aquisicao de Imobilizado', 'Venda de Ativos', 'Investimentos em Intangiveis', 'Total Atividades Investimento'], total: 'Total Atividades Investimento' },
  { title: 'Atividades de Financiamento', keys: ['Captacao de Emprestimos', 'Pagamento de Emprestimos', 'Aumento de Capital', 'Distribuicao de Resultados', 'Total Atividades Financiamento'], total: 'Total Atividades Financiamento' },
  { title: 'Variacao do Caixa', keys: ['Variacao Liquida do Caixa', 'Caixa Inicial', 'Caixa Final'], total: 'Caixa Final' }
];

const dmplGroups = [
  { title: 'Capital Social', keys: ['Saldo Inicial Capital', 'Integralizacao de Capital', 'Ajustes de Capital', 'Saldo Final Capital'], total: 'Saldo Final Capital' },
  { title: 'Reservas de Capital', keys: ['Saldo Inicial Reservas', 'Constituicao de Reservas', 'Utilizacao de Reservas', 'Saldo Final Reservas'], total: 'Saldo Final Reservas' },
  { title: 'Reserva Legal', keys: ['Saldo Inicial Reserva Legal', 'Destinacao do Resultado', 'Saldo Final Reserva Legal'], total: 'Saldo Final Reserva Legal' },
  { title: 'Resultados Acumulados', keys: ['Saldo Inicial Resultados', 'Resultado do Exercicio', 'Destinacao para Reservas', 'Ajustes de Exercicios Anteriores', 'Saldo Final Resultados'], total: 'Saldo Final Resultados' },
  { title: 'Total Patrimonio Liquido', keys: ['Saldo Inicial PL', 'Mutacoes do Periodo', 'Saldo Final PL'], total: 'Saldo Final PL' }
];

const dvaGroups = [
  { title: 'Receitas', keys: ['Receitas de Competicoes e Eventos', 'Receitas Comerciais e de Patrocinio', 'Receitas de Subvencoes e Convenios', 'Outras Receitas Operacionais', 'Total Receitas'], total: 'Total Receitas' },
  { title: '(-) Insumos Adquiridos de Terceiros', keys: ['Custos de Competicoes e Eventos', 'Materiais e Servicos de Terceiros', 'Servicos Tecnicos Especializados', 'Outros Insumos', 'Total Insumos'], total: 'Total Insumos' },
  { title: 'Valor Adicionado Bruto', keys: ['Valor Adicionado Bruto'], total: 'Valor Adicionado Bruto' },
  { title: '(-) Depreciacao e Amortizacao', keys: ['Depreciacao de Imobilizado', 'Amortizacao de Intangiveis', 'Total Depreciacao'], total: 'Total Depreciacao' },
  { title: 'Valor Adicionado Liquido', keys: ['Valor Adicionado Liquido'], total: 'Valor Adicionado Liquido' },
  { title: 'Valor Adicionado Recebido em Transferencia', keys: ['Receitas Financeiras', 'Resultado de Equivalencia', 'Total Transferencias'], total: 'Total Transferencias' },
  { title: 'Valor Adicionado Total a Distribuir', keys: ['Valor Adicionado Total'], total: 'Valor Adicionado Total' },
  { title: 'Distribuicao - Pessoal', keys: ['Remuneracao Direta', 'Beneficios', 'FGTS', 'Total Pessoal'], total: 'Total Pessoal' },
  { title: 'Distribuicao - Impostos', keys: ['Tributos Federais', 'Tributos Estaduais', 'Tributos Municipais', 'Total Impostos'], total: 'Total Impostos' },
  { title: 'Distribuicao - Capitais de Terceiros', keys: ['Despesas Financeiras', 'Alugueis', 'Total Capitais Terceiros'], total: 'Total Capitais Terceiros' },
  { title: 'Distribuicao - Capitais Proprios', keys: ['Superavit do Exercicio', 'Destinacao para Reservas', 'Total Capitais Proprios'], total: 'Total Capitais Proprios' }
];

// Dados fictícios para DFC
const dfcData: Record<string, Record<string, number>> = {
  '2025': {
    'Resultado do Periodo': 6100,
    'Ajustes de Depreciacoes': 3400,
    'Ajustes de Provisoes': 1600,
    'Variacao de Contas a Receber': -3200,
    'Variacao de Estoques': -500,
    'Variacao de Fornecedores': 2400,
    'Total Atividades Operacionais': 9800,
    'Aquisicao de Imobilizado': -9000,
    'Venda de Ativos': 1500,
    'Investimentos em Intangiveis': -2200,
    'Total Atividades Investimento': -9700,
    'Captacao de Emprestimos': 6000,
    'Pagamento de Emprestimos': -5800,
    'Aumento de Capital': 4000,
    'Distribuicao de Resultados': -3000,
    'Total Atividades Financiamento': 1200,
    'Variacao Liquida do Caixa': 1300,
    'Caixa Inicial': 15000,
    'Caixa Final': 16300
  }
};

// Dados fictícios para DMPL
const dmplData: Record<string, Record<string, number>> = {
  '2025': {
    'Saldo Inicial Capital': 40500,
    'Integralizacao de Capital': 4000,
    'Ajustes de Capital': 0,
    'Saldo Final Capital': 44500,
    'Saldo Inicial Reservas': 3250,
    'Constituicao de Reservas': 700,
    'Utilizacao de Reservas': -100,
    'Saldo Final Reservas': 3850,
    'Saldo Inicial Reserva Legal': 2285,
    'Destinacao do Resultado': 305,
    'Saldo Final Reserva Legal': 2590,
    'Saldo Inicial Resultados': 26415,
    'Resultado do Exercicio': 6100,
    'Destinacao para Reservas': -1005,
    'Ajustes de Exercicios Anteriores': 0,
    'Saldo Final Resultados': 31510,
    'Saldo Inicial PL': 72450,
    'Mutacoes do Periodo': 10000,
    'Saldo Final PL': 82450
  }
};

// Dados fictícios para DVA
const dvaData: Record<string, Record<string, number>> = {
  '2025': {
    'Receitas de Competicoes e Eventos': 42000,
    'Receitas Comerciais e de Patrocinio': 28000,
    'Receitas de Subvencoes e Convenios': 15000,
    'Outras Receitas Operacionais': 5000,
    'Total Receitas': 90000,
    'Custos de Competicoes e Eventos': -18000,
    'Materiais e Servicos de Terceiros': -12000,
    'Servicos Tecnicos Especializados': -6000,
    'Outros Insumos': -4000,
    'Total Insumos': -40000,
    'Valor Adicionado Bruto': 50000,
    'Depreciacao de Imobilizado': -2800,
    'Amortizacao de Intangiveis': -600,
    'Total Depreciacao': -3400,
    'Valor Adicionado Liquido': 46600,
    'Receitas Financeiras': 3500,
    'Resultado de Equivalencia': 500,
    'Total Transferencias': 4000,
    'Valor Adicionado Total': 50600,
    'Remuneracao Direta': 18000,
    'Beneficios': 4500,
    'FGTS': 1800,
    'Total Pessoal': 24300,
    'Tributos Federais': 8000,
    'Tributos Estaduais': 2500,
    'Tributos Municipais': 1500,
    'Total Impostos': 12000,
    'Despesas Financeiras': 4200,
    'Alugueis': 2000,
    'Total Capitais Terceiros': 6200,
    'Superavit do Exercicio': 6100,
    'Destinacao para Reservas': 2000,
    'Total Capitais Proprios': 8100
  }
};

function buscarContaPorCodigo(contas: ContaComValor[], codigo: string): number | undefined {
  for (const conta of contas) {
    if (conta.codigo === codigo) return conta.valor;
    if (conta.children?.length) {
      const nested = buscarContaPorCodigo(conta.children, codigo);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

export default function DemonstracoesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('bp');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Ativo Circulante', 'Patrimonio Liquido', 'Receitas Operacionais', 'Resultados', 'Atividades Operacionais', 'Variacao do Caixa', 'Capital Social', 'Total Patrimonio Liquido', 'Receitas', 'Distribuicao - Pessoal']);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingComparative, setGeneratingComparative] = useState(false);
  const [companyName, setCompanyName] = useState('Federação de Futebol');
  const [showFederacaoModal, setShowFederacaoModal] = useState(false);
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedFederacoes, setSelectedFederacoes] = useState<string[]>([]);
  const [financialData, setFinancialData] = useState<Record<string, FinancialApiData>>({});
  const [monthlyDreData, setMonthlyDreData] = useState<Record<string, Record<string, ContaComValor[]>>>({});
  const [loadingFinancialData, setLoadingFinancialData] = useState(false);
  const {
    selectedCompanyId,
    selectedYear,
    viewMode,
    selectedMonth,
  } = useDashboard();
  
  // Empresas disponíveis para comparação (direto do cadastro do usuário)
  const federacoesDisponiveis = userCompanies.map(uc => ({
    id: uc.id,
    nome: uc.name,
    sigla: uc.name.split(' ').filter(w => w.length > 2 && !['de', 'do', 'da', 'dos', 'das'].includes(w.toLowerCase())).map(w => w[0].toUpperCase()).join('').substring(0, 4),
  }));

  // Buscar empresas do usuário
  useEffect(() => {
    const fetchUserCompanies = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.USER_COMPANIES);
        if (response.ok) {
          const data = await response.json();
          console.log('Empresas do usuário:', data.companies);
          setUserCompanies(data.companies || []);
        } else {
          console.error('Erro ao buscar empresas:', response.status);
        }
      } catch (error) {
        console.error('Erro ao buscar empresas:', error);
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchUserCompanies();
  }, []);

  // Atualizar seleção quando as federações disponíveis mudarem
  useEffect(() => {
    console.log('Federações disponíveis:', federacoesDisponiveis);
    if (federacoesDisponiveis.length > 0) {
      setSelectedFederacoes(federacoesDisponiveis.map(f => f.id));
    }
  }, [userCompanies]);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = localStorage.getItem('selectedCompanyName');
      if (stored) setCompanyName(stored);
    };
    
    // Ler ao montar
    syncFromStorage();
    
    // Ouvir mudanças (quando sidebar troca empresa e faz reload)
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  // Buscar dados financeiros da API quando empresa ou ano mudar
  const fetchFinancialData = useCallback(async (companyId: string, year: string, mode: 'anual' | 'mensal', month?: string) => {
    if (!companyId) return;
    
    setLoadingFinancialData(true);
    try {
      const params = new URLSearchParams({
        companyId,
        viewMode: mode,
        year,
      });
      if (mode === 'mensal' && month) {
        params.set('month', month);
      }

      const response = await fetch(`${API_ENDPOINTS.FINANCIAL_DATA}?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setFinancialData(prev => ({
            ...prev,
            [year]: result.data
          }));
          console.log(`Dados financeiros ${year}:`, result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados financeiros:', error);
    } finally {
      setLoadingFinancialData(false);
    }
  }, []);

  const fetchMonthlyDreYear = useCallback(async (companyId: string, year: string) => {
    const monthsMap: Record<string, ContaComValor[]> = {};

    await Promise.all(
      MONTHS.map(async (month) => {
        try {
          const params = new URLSearchParams({
            companyId,
            viewMode: 'mensal',
            year,
            month: month.value,
          });
          const response = await fetch(`${API_ENDPOINTS.FINANCIAL_DATA}?${params.toString()}`);
          if (!response.ok) {
            monthsMap[month.value] = [];
            return;
          }

          const result = await response.json();
          monthsMap[month.value] = ordenarArvoreDreReceitaBrutaPrimeiro(result?.data?.estruturaDRE || []);
        } catch (error) {
          console.error(`Erro ao buscar DRE mensal ${month.value}/${year}:`, error);
          monthsMap[month.value] = [];
        }
      })
    );

    return monthsMap;
  }, []);

  // Buscar dados para todos os anos quando a empresa for selecionada
  useEffect(() => {
    if (!selectedCompanyId) return;

    if (viewMode === 'anual') {
      anosDisponiveis.forEach(year => {
        fetchFinancialData(selectedCompanyId, year, 'anual');
      });
      setMonthlyDreData({});
      return;
    }

    const previousYear = String(Number(selectedYear) - 1);

    const fetchMonthlyMatrix = async () => {
      setLoadingFinancialData(true);
      try {
        const [currentYearData, previousYearData] = await Promise.all([
          fetchMonthlyDreYear(selectedCompanyId, selectedYear),
          fetchMonthlyDreYear(selectedCompanyId, previousYear),
        ]);

        setMonthlyDreData({
          [selectedYear]: currentYearData,
          [previousYear]: previousYearData,
        });
      } finally {
        setLoadingFinancialData(false);
      }
    };

    fetchMonthlyMatrix();
  }, [selectedCompanyId, viewMode, selectedYear, selectedMonth, fetchFinancialData, fetchMonthlyDreYear]);

  const handleGeneratePdf = async () => {
    const companyIdToUse = selectedCompanyId || localStorage.getItem('selectedCompany');
    const companyNameToUse = companyName || localStorage.getItem('selectedCompanyName') || 'empresa';

    if (!companyIdToUse) {
      alert('Selecione uma empresa no menu lateral');
      return;
    }
    setGeneratingPdf(true);
    try {
      const response = await fetch(API_ENDPOINTS.GENERATE_REPORT_PDF, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: companyIdToUse, companyName: companyNameToUse, year: selectedYear }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar PDF');
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf')) {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          throw new Error(parsed.error || 'O serviço não retornou um PDF válido');
        } catch {
          throw new Error('O serviço não retornou um PDF válido');
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_financeiro_${companyNameToUse.replace(/\s+/g, '_')}_${selectedYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert(error instanceof Error ? error.message : 'Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleGenerateComparativePdf = async () => {
    if (selectedFederacoes.length < 2) {
      alert('Selecione pelo menos 2 federações para comparar');
      return;
    }
    
    setShowFederacaoModal(false);
    setGeneratingComparative(true);
    try {
      const response = await fetch(API_ENDPOINTS.GENERATE_COMPARATIVE_PDF, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, companyIds: selectedFederacoes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar PDF comparativo');
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf')) {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          throw new Error(parsed.error || 'O serviço não retornou um PDF comparativo válido');
        } catch {
          throw new Error('O serviço não retornou um PDF comparativo válido');
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `comparativo_federacoes_${selectedYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao gerar PDF comparativo:', error);
      alert(error instanceof Error ? error.message : 'Erro ao gerar PDF comparativo');
    } finally {
      setGeneratingComparative(false);
    }
  };

  const toggleFederacao = (id: string) => {
    setSelectedFederacoes(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const selectAllFederacoes = () => {
    setSelectedFederacoes(federacoesDisponiveis.map(f => f.id));
  };

  const deselectAllFederacoes = () => {
    setSelectedFederacoes([]);
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  // Mapeamento de chaves da interface para chaves da API
  const dreKeyMapping: Record<string, { group: 'receitas' | 'custos' | 'despesas' | 'resultados', apiKey?: string }> = {
    'Receitas de Competicoes': { group: 'receitas', apiKey: 'Receitas de Competições' },
    'Receitas de Repasses': { group: 'receitas', apiKey: 'Programa de Auxilios Financeiros' },
    'Receitas de Convenios e Parcerias': { group: 'receitas', apiKey: 'Receitas de Convênios' },
    'Outras Receitas Operacionais': { group: 'receitas', apiKey: 'Outras Receitas' },
    'Total Receitas Operacionais': { group: 'resultados', apiKey: 'totalReceitas' },
    'Custos com Competicoes': { group: 'custos', apiKey: 'Custos com Competições' },
    'Custos com Desenvolvimento do Futebol': { group: 'custos', apiKey: 'Custos com Desenvolvimento' },
    'Custos com Infraestrutura Esportiva': { group: 'custos', apiKey: 'Custos com Infraestrutura' },
    'Total Custos': { group: 'resultados', apiKey: 'totalCustos' },
    'Despesas com Pessoal': { group: 'despesas', apiKey: 'Despesas com Pessoal' },
    'Despesas Administrativas': { group: 'despesas', apiKey: 'Despesas Administrativas' },
    'Despesas Comerciais e Marketing': { group: 'despesas', apiKey: 'Despesas Comerciais' },
    'Outras Despesas Operacionais': { group: 'despesas', apiKey: 'Outras Despesas' },
    'Total Despesas Operacionais': { group: 'resultados', apiKey: 'totalDespesas' },
    'Resultado Operacional': { group: 'resultados', apiKey: 'resultadoOperacional' },
    'Resultado Financeiro': { group: 'resultados', apiKey: 'resultadoFinanceiro' },
    'Resultado Nao Operacional': { group: 'resultados', apiKey: 'resultadoNaoOperacional' },
    'Resultado Liquido': { group: 'resultados', apiKey: 'resultadoLiquido' },
  };

  const bpKeyMapping: Record<string, { group: 'ativoCirculante' | 'ativoNaoCirculante' | 'passivoCirculante' | 'passivoNaoCirculante' | 'patrimonioLiquido', apiKey?: string }> = {
    'Total Disponibilidades': { group: 'ativoCirculante', apiKey: 'Disponibilidades' },
    'Total Contas a Receber': { group: 'ativoCirculante', apiKey: 'Contas a Receber' },
    'Total Estoques': { group: 'ativoCirculante', apiKey: 'Estoques' },
    'Total Ativo Circulante': { group: 'ativoCirculante', apiKey: 'TOTAL_ATIVO_CIRCULANTE' },
    'Total Imobilizado Liquido': { group: 'ativoNaoCirculante', apiKey: 'Imobilizado' },
    'Total Intangivel': { group: 'ativoNaoCirculante', apiKey: 'Intangível' },
    'Total Ativo Nao Circulante': { group: 'ativoNaoCirculante', apiKey: 'TOTAL_ATIVO_NAO_CIRCULANTE' },
    'Fornecedores': { group: 'passivoCirculante', apiKey: 'Fornecedores' },
    'Emprestimos Bancarios CP': { group: 'passivoCirculante', apiKey: 'Empréstimos CP' },
    'Total Passivo Circulante': { group: 'passivoCirculante', apiKey: 'TOTAL_PASSIVO_CIRCULANTE' },
    'Emprestimos Bancarios LP': { group: 'passivoNaoCirculante', apiKey: 'Empréstimos LP' },
    'Financiamentos LP': { group: 'passivoNaoCirculante', apiKey: 'Financiamentos' },
    'Total Passivo Nao Circulante': { group: 'passivoNaoCirculante', apiKey: 'TOTAL_PASSIVO_NAO_CIRCULANTE' },
    'Capital Social': { group: 'patrimonioLiquido', apiKey: 'Capital Social' },
    'Reserva Legal': { group: 'patrimonioLiquido', apiKey: 'Reservas' },
    'Superavits Acumulados': { group: 'patrimonioLiquido', apiKey: 'Lucros Acumulados' },
    'Total Patrimonio Liquido': { group: 'patrimonioLiquido', apiKey: 'TOTAL_PATRIMONIO_LIQUIDO' },
  };

  const getDreValue = (year: string, key: string) => {
    // Primeiro tenta buscar da API
    const apiData = financialData[year];
    if (apiData?.dre) {
      const mapping = dreKeyMapping[key];
      if (mapping) {
        const group = apiData.dre[mapping.group];
        if (group && mapping.apiKey) {
          // Busca pela chave exata ou normalizada
          const value = group[mapping.apiKey];
          if (value !== undefined) return value / 1000; // Converte para milhares
          
          // Tenta buscar por chave normalizada
          const normalizedApiKey = mapping.apiKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          const foundKey = Object.keys(group).find(k => 
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedApiKey
          );
          if (foundKey) return group[foundKey] / 1000;
        }
      }
      
      // Busca genérica em todos os grupos
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const groupName of ['receitas', 'custos', 'despesas', 'resultados'] as const) {
        const group = apiData.dre[groupName];
        if (group) {
          const foundKey = Object.keys(group).find(k => 
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey
          );
          if (foundKey) return group[foundKey] / 1000;
        }
      }
    }
    
    return 0;
  };

  const getBpValue = (year: string, key: string) => {
    // Primeiro tenta buscar da API
    const apiData = financialData[year];
    if (apiData?.bp) {
      const mapping = bpKeyMapping[key];
      if (mapping) {
        const group = apiData.bp[mapping.group];
        if (group && mapping.apiKey) {
          const value = group[mapping.apiKey];
          if (value !== undefined) return value / 1000; // Converte para milhares
          
          // Tenta buscar por chave normalizada
          const normalizedApiKey = mapping.apiKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          const foundKey = Object.keys(group).find(k => 
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedApiKey
          );
          if (foundKey) return group[foundKey] / 1000;
        }
      }
      
      // Busca genérica em todos os grupos
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const groupName of ['ativoCirculante', 'ativoNaoCirculante', 'passivoCirculante', 'passivoNaoCirculante', 'patrimonioLiquido'] as const) {
        const group = apiData.bp[groupName];
        if (group) {
          const foundKey = Object.keys(group).find(k => 
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey
          );
          if (foundKey) return group[foundKey] / 1000;
        }
      }
    }
    
    return 0;
  };

  const getDfcValue = (year: string, key: string) => {
    return dfcData[year]?.[key] ?? 0;
  };

  const getDmplValue = (year: string, key: string) => {
    return dmplData[year]?.[key] ?? 0;
  };

  const getDvaValue = (year: string, key: string) => {
    return dvaData[year]?.[key] ?? 0;
  };

  const getGroups = () => {
    switch (activeTab) {
      case 'bp': return bpGroups;
      case 'dre': return dreGroups;
      case 'dfc': return dfcGroups;
      case 'dmpl': return dmplGroups;
      case 'dva': return dvaGroups;
      default: return bpGroups;
    }
  };

  const getValue = (year: string, key: string) => {
    switch (activeTab) {
      case 'bp': return getBpValue(year, key);
      case 'dre': return getDreValue(year, key);
      case 'dfc': return getDfcValue(year, key);
      case 'dmpl': return getDmplValue(year, key);
      case 'dva': return getDvaValue(year, key);
      default: return 0;
    }
  };

  const groups = getGroups();

  const getDreChartValue = (year: string, groupTitle: string): number => {
    const estrutura = financialData[year]?.estruturaDRE;
    if (!estrutura || estrutura.length === 0) return 0;

    const groupCodes: Record<string, string[]> = {
      'Receitas Operacionais': ['56', '51'],
      'Custos': ['57'],
      'Despesas Operacionais': ['110'],
      'Resultados': ['229', '227', '225', '210'],
    };

    const codes = groupCodes[groupTitle];
    if (!codes) return 0;

    for (const code of codes) {
      const value = buscarContaPorCodigo(estrutura, code);
      if (value !== undefined) return value / 1000;
    }

    return 0;
  };

  const chartData = groups.map(g => ({
    name: g.title.substring(0, 15),
    [selectedYear]: Math.abs(
      activeTab === 'dre'
        ? (getDreChartValue(selectedYear, g.title) || getValue(selectedYear, g.total))
        : getValue(selectedYear, g.total)
    )
  }));

  const getTabTitle = () => {
    switch (activeTab) {
      case 'bp': return 'Balanço Patrimonial';
      case 'dre': return 'DRE - Demonstração do Resultado';
      case 'dfc': return 'DFC - Demonstração do Fluxo de Caixa';
      case 'dmpl': return 'DMPL - Demonstração das Mutações do PL';
      case 'dva': return 'DVA - Demonstração do Valor Adicionado';
      default: return '';
    }
  };

  const getTabColor = () => {
    switch (activeTab) {
      case 'bp': return 'bg-blue-600';
      case 'dre': return 'bg-indigo-600';
      case 'dfc': return 'bg-emerald-600';
      case 'dmpl': return 'bg-purple-600';
      case 'dva': return 'bg-amber-600';
      default: return 'bg-blue-600';
    }
  };

  // Função para renderizar contas da estrutura base recursivamente
  // Mostra contas sintéticas (níveis 1-2) com opção de expandir para analíticas
  const renderEstruturaRows = (accounts: ContaComValor[], level: number = 0, showAll: boolean = false): JSX.Element[] => {
    const rows: JSX.Element[] = [];
    
    accounts.forEach((account) => {
      const isExpandable = account.children && account.children.length > 0;
      const isExpanded = expandedGroups.includes(account.codigo);
      const indent = account.nivelVisualizacao * 16;
      
      // Determina o estilo baseado no nível de visualização
      const nivelVis = account.nivelVisualizacao;
      const bgClass = nivelVis === 1 ? 'bg-slate-200' : nivelVis === 2 ? 'bg-slate-100' : nivelVis === 3 ? 'bg-slate-50' : '';
      const fontWeight = nivelVis <= 2 ? 'font-semibold' : nivelVis === 3 ? 'font-medium' : 'font-normal';
      const textColor = nivelVis === 1 ? 'text-slate-900' : nivelVis === 2 ? 'text-slate-800' : nivelVis === 3 ? 'text-slate-700' : 'text-slate-600';
      const fontSize = nivelVis <= 2 ? 'text-sm' : 'text-xs';
      
      // Verifica se tem valor ou filhos com valor (recursivo)
      const hasValueRecursive = (acc: ContaComValor): boolean => {
        if (acc.valor !== 0) return true;
        if (acc.children && acc.children.length > 0) {
          return acc.children.some(child => hasValueRecursive(child));
        }
        return false;
      };
      
      // Só exibe linhas com valor ou que tenham filhos com valor
      if (!hasValueRecursive(account)) return;
      
      rows.push(
        <tr 
          key={account.codigo}
          className={`${bgClass} ${isExpandable ? 'cursor-pointer hover:bg-slate-200' : 'hover:bg-slate-50'} border-b border-slate-100 transition-colors`}
          onClick={() => isExpandable && toggleGroup(account.codigo)}
        >
          <td className={`px-4 py-2 ${fontWeight} ${textColor} ${fontSize}`} style={{ paddingLeft: `${16 + indent}px` }}>
            <div className="flex items-center gap-2">
              {isExpandable && (
                <span className="flex-shrink-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
              )}
              <span>{account.descricao}</span>
            </div>
          </td>
          <td className={`text-right px-4 py-2 ${fontWeight} ${textColor} ${fontSize}`}>
            {formatCurrency(account.valor / 1000)}
          </td>
        </tr>
      );
      
      // Renderiza filhos se expandido (mostra grupos sintéticos e analíticos)
      if (isExpandable && isExpanded && account.children) {
        rows.push(...renderEstruturaRows(account.children, level + 1, showAll));
      }
    });
    
    return rows;
  };
  
  // Função para calcular o total Passivo + PL para exibição
  const getTotalPassivoPL = (): number => {
    const data = financialData[selectedYear];
    if (data?.totalPassivoPL) {
      return data.totalPassivoPL;
    }
    // Fallback: calcula a partir dos dados
    if (data?.estruturaBP) {
      let totalPassivo = 0;
      let totalPL = 0;
      
      const buscarValor = (contas: ContaComValor[], codigo: string): number => {
        for (const conta of contas) {
          if (conta.codigo === codigo) return conta.valor;
          if (conta.children) {
            const val = buscarValor(conta.children, codigo);
            if (val !== 0) return val;
          }
        }
        return 0;
      };
      
      totalPassivo = buscarValor(data.estruturaBP, '76');
      totalPL = buscarValor(data.estruturaBP, '125');
      return totalPassivo + totalPL;
    }
    return 0;
  };

  // Função para renderizar contas hierárquicas brutas (fallback)
  const renderHierarchicalRows = (accounts: HierarchicalAccount[], level: number = 0): JSX.Element[] => {
    const rows: JSX.Element[] = [];
    
    accounts.forEach((account) => {
      const isExpandable = account.children && account.children.length > 0;
      const isExpanded = expandedGroups.includes(account.codigo);
      const indent = level * 20;
      
      // Determina o estilo baseado no nível
      const bgClass = level === 0 ? 'bg-slate-100' : level === 1 ? 'bg-slate-50' : '';
      const fontWeight = level <= 1 ? 'font-semibold' : 'font-normal';
      const textColor = level === 0 ? 'text-slate-800' : level === 1 ? 'text-slate-700' : 'text-slate-600';
      
      rows.push(
        <tr 
          key={account.codigo}
          className={`${bgClass} ${isExpandable ? 'cursor-pointer hover:bg-slate-100' : 'hover:bg-slate-50'} border-b border-slate-100`}
          onClick={() => isExpandable && toggleGroup(account.codigo)}
        >
          <td className={`px-4 py-2 ${fontWeight} ${textColor}`} style={{ paddingLeft: `${16 + indent}px` }}>
            <div className="flex items-center gap-2">
              {isExpandable && (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-xs text-slate-400 mr-2">{account.codigo}</span>
              {account.descricao}
            </div>
          </td>
          <td className={`text-right px-4 py-2 ${fontWeight} ${textColor}`}>
            {formatCurrency(account.valor / 1000)}
          </td>
        </tr>
      );
      
      // Renderiza filhos se expandido
      if (isExpandable && isExpanded && account.children) {
        rows.push(...renderHierarchicalRows(account.children, level + 1));
      }
    });
    
    return rows;
  };

  // Verifica se tem dados da estrutura base disponíveis (prioridade)
  const hasEstruturaData = (tab: TabType): boolean => {
    const data = financialData[selectedYear];
    if (!data) return false;
    
    if (tab === 'dre' && data.estruturaDRE && data.estruturaDRE.length > 0) return true;
    if (tab === 'bp' && data.estruturaBP && data.estruturaBP.length > 0) return true;
    return false;
  };

  // Verifica se tem dados hierárquicos disponíveis (fallback)
  const hasHierarchicalData = (tab: TabType): boolean => {
    const data = financialData[selectedYear];
    if (!data) return false;
    
    if (tab === 'dre' && data.hierarchicalDRE) return true;
    if (tab === 'bp' && data.hierarchicalBP) return true;
    return false;
  };

  // Obtém dados da estrutura base para a tab atual
  const getEstruturaData = (): ContaComValor[] => {
    const data = financialData[selectedYear];
    if (!data) return [];
    
    if (activeTab === 'dre' && data.estruturaDRE) return ordenarArvoreDreReceitaBrutaPrimeiro(data.estruturaDRE);
    if (activeTab === 'bp' && data.estruturaBP) return data.estruturaBP;
    return [];
  };

  // Obtém dados hierárquicos para a tab atual (fallback)
  const getHierarchicalData = (): HierarchicalAccount[] => {
    const data = financialData[selectedYear];
    if (!data) return [];
    
    if (activeTab === 'dre' && data.hierarchicalDRE) {
      return [...data.hierarchicalDRE.receitas, ...data.hierarchicalDRE.custos];
    }
    if (activeTab === 'bp' && data.hierarchicalBP) {
      return [...data.hierarchicalBP.ativo, ...data.hierarchicalBP.passivo, ...data.hierarchicalBP.patrimonioLiquido];
    }
    return [];
  };

  const previousYear = String(Number(selectedYear) - 1);
  const selectedMonthIndex = MONTHS.findIndex((m) => m.value === selectedMonth);
  const ytdMonths = selectedMonthIndex >= 0 ? MONTHS.slice(0, selectedMonthIndex + 1) : MONTHS;

  const flattenContas = useCallback((contas: ContaComValor[]): ContaComValor[] => {
    const result: ContaComValor[] = [];
    const walk = (items: ContaComValor[]) => {
      for (const item of items) {
        result.push(item);
        if (item.children?.length) {
          walk(item.children);
        }
      }
    };
    walk(contas);
    return result;
  }, []);

  const getAccountNature = useCallback((conta: { codigo: string; descricao: string }): 'receita' | 'despesa' | 'neutro' => {
    const descricao = conta.descricao?.toLowerCase?.() || '';
    const codigo = conta.codigo || '';

    if (descricao.includes('receita') || codigo === '51' || codigo === '56') return 'receita';
    if (
      descricao.includes('custo') ||
      descricao.includes('despesa') ||
      codigo === '57' ||
      codigo === '110'
    ) {
      return 'despesa';
    }

    return 'neutro';
  }, []);

  const dreMonthlyRows = useMemo(() => {
    if (viewMode !== 'mensal') return [] as Array<{
      codigo: string;
      descricao: string;
      nivel: number;
      monthlyValues: Record<string, number>;
      previousYTD: number;
      currentYTD: number;
      variationPct: number;
    }>;

    const currentYearMonths = monthlyDreData[selectedYear] || {};
    const previousYearMonths = monthlyDreData[previousYear] || {};

    const globalParentMap = new Map<string, string | null>();
    const registerParents = (contas: ContaComValor[]) => {
      flattenContas(contas).forEach((conta) => {
        if (!globalParentMap.has(conta.codigo)) {
          globalParentMap.set(conta.codigo, conta.codigoSuperior ?? null);
        }
      });
    };

    MONTHS.forEach((month) => {
      registerParents(currentYearMonths[month.value] || []);
      registerParents(previousYearMonths[month.value] || []);
    });

    const monthPriority = [
      selectedMonth,
      ...MONTHS.map((m) => m.value).filter((month) => month !== selectedMonth),
    ];

    const templateContas =
      monthPriority
        .map((month) => currentYearMonths[month])
        .find((contas) => Array.isArray(contas) && contas.length > 0) ||
      monthPriority
        .map((month) => previousYearMonths[month])
        .find((contas) => Array.isArray(contas) && contas.length > 0) ||
      [];

    const canonicalRows = flattenContas(templateContas)
      .filter((conta) => (conta.nivelVisualizacao || 1) <= 2)
      .reduce((acc, conta) => {
        if (!acc.some((item) => item.codigo === conta.codigo)) {
          acc.push(conta);
        }
        return acc;
      }, [] as ContaComValor[]);

    if (canonicalRows.length === 0) {
      return [];
    }

    const structureOrderMap = new Map<string, number>();
    canonicalRows.forEach((conta, index) => {
      structureOrderMap.set(conta.codigo, index);
    });

    const canonicalParentMap = new Map<string, string | null>();
    canonicalRows.forEach((conta) => {
      canonicalParentMap.set(conta.codigo, conta.codigoSuperior);
    });

    const canonicalLastDescendantOrder = new Map<string, number>();
    canonicalRows.forEach((conta, index) => {
      let ancestor = conta.codigoSuperior;
      const visited = new Set<string>();
      while (ancestor && !visited.has(ancestor)) {
        visited.add(ancestor);
        const previousMax = canonicalLastDescendantOrder.get(ancestor) ?? structureOrderMap.get(ancestor) ?? -1;
        if (index > previousMax) {
          canonicalLastDescendantOrder.set(ancestor, index);
        }
        ancestor = canonicalParentMap.get(ancestor) ?? null;
      }
    });

    const rowMap = new Map<string, {
      codigo: string;
      descricao: string;
      nivel: number;
      codigoSuperior: string | null;
      monthlyValues: Record<string, number>;
    }>();
    canonicalRows.forEach((conta) => {
      rowMap.set(conta.codigo, {
        codigo: conta.codigo,
        descricao: conta.descricao,
        nivel: conta.nivelVisualizacao || 1,
        codigoSuperior: conta.codigoSuperior,
        monthlyValues: Object.fromEntries(MONTHS.map((m) => [m.value, 0])),
      });
    });

    const ensureRow = (conta: ContaComValor) => {
      const existing = rowMap.get(conta.codigo);
      if (existing) {
        if (!existing.codigoSuperior && conta.codigoSuperior) {
          existing.codigoSuperior = conta.codigoSuperior;
        }
        return existing;
      }

      const created = {
        codigo: conta.codigo,
        descricao: conta.descricao,
        nivel: conta.nivelVisualizacao || 1,
        codigoSuperior: conta.codigoSuperior,
        monthlyValues: Object.fromEntries(MONTHS.map((m) => [m.value, 0])),
      };
      rowMap.set(conta.codigo, created);
      return created;
    };

    MONTHS.forEach((month) => {
      const contasMes = currentYearMonths[month.value] || [];
      const flat = flattenContas(contasMes).filter((c) => (c.nivelVisualizacao || 1) <= 2);
      flat.forEach((conta) => {
        const row = ensureRow(conta);
        row.monthlyValues[month.value] = conta.valor || 0;
      });
    });

    MONTHS.forEach((month) => {
      const contasMesAnterior = previousYearMonths[month.value] || [];
      const flatPrev = flattenContas(contasMesAnterior).filter((c) => (c.nivelVisualizacao || 1) <= 2);
      flatPrev.forEach((conta) => ensureRow(conta));
    });

    const allParentMap = new Map<string, string | null>();
    rowMap.forEach((row) => {
      allParentMap.set(row.codigo, row.codigoSuperior ?? null);
    });
    globalParentMap.forEach((parent, codigo) => {
      if (!allParentMap.has(codigo)) {
        allParentMap.set(codigo, parent ?? null);
      }
    });

    const getAnchorOrder = (codigo: string): number | undefined => {
      if (structureOrderMap.has(codigo)) {
        return structureOrderMap.get(codigo);
      }

      let parent = allParentMap.get(codigo) ?? globalParentMap.get(codigo) ?? null;
      const visited = new Set<string>();

      while (parent && !visited.has(parent)) {
        visited.add(parent);
        if (structureOrderMap.has(parent)) {
          return structureOrderMap.get(parent);
        }
        parent = allParentMap.get(parent) ?? globalParentMap.get(parent) ?? null;
      }

      return undefined;
    };

    const getYearMonthValue = (yearMonths: Record<string, ContaComValor[]>, month: string, codigo: string) => {
      const contas = yearMonths[month] || [];
      const flat = flattenContas(contas);
      return flat.find((c) => c.codigo === codigo)?.valor || 0;
    };

    const orderedRows = Array.from(rowMap.values())
      .map((row) => {
        const previousYTD = ytdMonths.reduce(
          (sum, month) => sum + getYearMonthValue(previousYearMonths, month.value, row.codigo),
          0
        );

        const currentYTD = ytdMonths.reduce(
          (sum, month) => sum + getYearMonthValue(currentYearMonths, month.value, row.codigo),
          0
        );

        const natureza = getAccountNature(row);
        const rawDiff = currentYTD - previousYTD;
        const adjustedDiff = natureza === 'despesa' ? -rawDiff : rawDiff;
        const variationPct = previousYTD === 0
          ? (adjustedDiff === 0 ? 0 : 100)
          : (adjustedDiff / Math.abs(previousYTD)) * 100;

        return {
          ...row,
          previousYTD,
          currentYTD,
          variationPct,
        };
      })
      .filter((row) => {
        const hasMonthlyValue = ytdMonths.some((month) => Math.abs(row.monthlyValues[month.value] || 0) > 0);
        const hasYtdValue = Math.abs(row.previousYTD) > 0 || Math.abs(row.currentYTD) > 0;
        return hasMonthlyValue || hasYtdValue;
      })
      .sort((a, b) => {
        const isKnownA = structureOrderMap.has(a.codigo);
        const isKnownB = structureOrderMap.has(b.codigo);

        if (isKnownA && isKnownB) {
          return (structureOrderMap.get(a.codigo) || 0) - (structureOrderMap.get(b.codigo) || 0);
        }

        if (isKnownA && !isKnownB) {
          const anchorB = getAnchorOrder(b.codigo);
          const baseB = anchorB !== undefined
            ? (canonicalLastDescendantOrder.get(canonicalRows[anchorB]?.codigo || '') ?? anchorB)
            : Number.MAX_SAFE_INTEGER;
          return (structureOrderMap.get(a.codigo) || 0) - baseB;
        }

        if (!isKnownA && isKnownB) {
          const anchorA = getAnchorOrder(a.codigo);
          const baseA = anchorA !== undefined
            ? (canonicalLastDescendantOrder.get(canonicalRows[anchorA]?.codigo || '') ?? anchorA)
            : Number.MAX_SAFE_INTEGER;
          return baseA - (structureOrderMap.get(b.codigo) || 0);
        }

        const anchorA = getAnchorOrder(a.codigo);
        const anchorB = getAnchorOrder(b.codigo);

        const anchorBaseA = anchorA !== undefined
          ? (canonicalLastDescendantOrder.get(canonicalRows[anchorA]?.codigo || '') ?? anchorA)
          : Number.MAX_SAFE_INTEGER;
        const anchorBaseB = anchorB !== undefined
          ? (canonicalLastDescendantOrder.get(canonicalRows[anchorB]?.codigo || '') ?? anchorB)
          : Number.MAX_SAFE_INTEGER;

        if (anchorBaseA !== anchorBaseB) return anchorBaseA - anchorBaseB;

        const codeA = parseFloat(a.codigo.replace(',', '.'));
        const codeB = parseFloat(b.codigo.replace(',', '.'));
        if (!Number.isNaN(codeA) && !Number.isNaN(codeB) && codeA !== codeB) return codeA - codeB;

        return a.descricao.localeCompare(b.descricao);
      });

      return ordenarDreReceitaBrutaPrimeiro(orderedRows);
  }, [viewMode, monthlyDreData, selectedYear, previousYear, selectedMonth, ytdMonths, flattenContas, getAccountNature]);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <FileSpreadsheet className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Demonstrações Financeiras</h1>
        </div>
        <p className="text-blue-100">BP, DRE, DFC, DMPL e DVA</p>
      </motion.div>

      {viewMode === 'mensal' ? (
        <motion.div
          key={`dre-mensal-${selectedYear}-${selectedMonth}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          <div className="bg-indigo-600 px-4 py-3">
            <h2 className="font-semibold text-white">
              DRE - Visão Mensal ({selectedYear})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1600px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-slate-100 z-0">Conta</th>
                  {ytdMonths.map((month) => (
                    <th key={month.value} className="text-right px-3 py-3 font-semibold text-slate-700">{month.label}</th>
                  ))}
                  <th className="text-right px-3 py-3 font-semibold text-slate-700">{selectedYear}</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-700">{previousYear}</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-700">Variação</th>
                </tr>
              </thead>
              <tbody>
                {dreMonthlyRows.map((row) => (
                  <tr key={row.codigo} className={`border-b border-slate-100 ${row.nivel === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                    <td
                      className={`px-4 py-2 sticky left-0 z-0 ${row.nivel === 1 ? 'font-semibold text-slate-900 bg-slate-50' : 'text-slate-700 bg-white'}`}
                      style={{ paddingLeft: `${16 + row.nivel * 12}px` }}
                    >
                      {row.descricao}
                    </td>
                    {ytdMonths.map((month) => (
                      <td key={`${row.codigo}-${month.value}`} className="text-right px-3 py-2 text-slate-700">
                        {formatCurrency((row.monthlyValues[month.value] || 0) / 1000)}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 font-medium text-slate-900">
                      {formatCurrency(row.currentYTD / 1000)}
                    </td>
                    <td className="text-right px-3 py-2 font-medium text-slate-700">
                      {formatCurrency(row.previousYTD / 1000)}
                    </td>
                    <td className={`text-right px-3 py-2 font-semibold ${row.variationPct > 0 ? 'text-emerald-600' : row.variationPct < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                      {row.variationPct > 0 ? '+' : ''}{row.variationPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
      <>
      {/* Tabs das Demonstrações - Ordem: BP, DRE, DFC, DMPL, DVA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('bp')}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'bp' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            BP
          </button>
          <button
            onClick={() => setActiveTab('dre')}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'dre' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            DRE
          </button>
          <button
            onClick={() => setActiveTab('dfc')}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'dfc' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            DFC
          </button>
          <button
            onClick={() => setActiveTab('dmpl')}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'dmpl' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            DMPL
          </button>
          <button
            onClick={() => setActiveTab('dva')}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${activeTab === 'dva' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            DVA
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold shadow-lg hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                PDF Individual
              </>
            )}
          </button>
          {/* Botão PDF Comparativo - só aparece se o usuário tem acesso a 2+ federações */}
          {!loadingCompanies && federacoesDisponiveis.length >= 2 && (
            <button
              onClick={() => setShowFederacaoModal(true)}
              disabled={generatingComparative}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-lg font-semibold shadow-lg hover:from-violet-700 hover:to-violet-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {generatingComparative ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileBarChart className="w-4 h-4" />
                  PDF Comparativo
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <motion.div
        key={activeTab + selectedYear}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className={`${getTabColor()} px-4 py-3`}>
          <h2 className="font-semibold text-white">{getTabTitle()} - Exercício {selectedYear}</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left px-4 py-3 font-semibold text-slate-700 w-2/3">Conta</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-700 w-1/3">
                Valor (R$ mil)
              </th>
            </tr>
          </thead>
          <tbody>
            {hasEstruturaData(activeTab) ? (
              // PRIORIDADE: Renderiza dados da estrutura base (de-para)
              <>
                {renderEstruturaRows(getEstruturaData())}
              </>
            ) : hasHierarchicalData(activeTab) ? (
              // FALLBACK 1: Renderiza dados hierárquicos brutos do banco
              renderHierarchicalRows(getHierarchicalData())
            ) : (
              // FALLBACK 2: Grupos estáticos de demonstração
              groups.map((group) => (
                <React.Fragment key={group.title}>
                  <tr 
                    className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleGroup(group.title)}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                      {expandedGroups.includes(group.title) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {group.title}
                    </td>
                    <td className="text-right px-4 py-3 font-semibold text-slate-800">
                      {formatCurrency(getValue(selectedYear, group.total))}
                    </td>
                  </tr>
                  {expandedGroups.includes(group.title) && group.keys.filter(k => k !== group.total).map((key) => (
                    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 pl-10 text-slate-600">{key}</td>
                      <td className="text-right px-4 py-2 text-slate-700">
                        {formatCurrency(getValue(selectedYear, key))}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">Composição por Grupo - {getTabTitle()} ({selectedYear})</h2>
        <CustomBarChart
          data={chartData}
          bars={[
            { dataKey: selectedYear, color: activeTab === 'bp' ? '#3B82F6' : activeTab === 'dre' ? '#6366F1' : activeTab === 'dfc' ? '#10B981' : activeTab === 'dmpl' ? '#8B5CF6' : '#F59E0B', name: selectedYear }
          ]}
        />
      </motion.div>
      </>
      )}

      {/* Modal de Seleção de Federações */}
      {showFederacaoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Selecionar Federações para Comparação</h3>
              <button
                onClick={() => setShowFederacaoModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-4">
                Selecione as federações que deseja incluir no relatório comparativo (mínimo 2):
              </p>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={selectAllFederacoes}
                  className="text-sm px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors"
                >
                  Selecionar Todas
                </button>
                <button
                  onClick={deselectAllFederacoes}
                  className="text-sm px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Limpar Seleção
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {federacoesDisponiveis.map((fed) => (
                  <label
                    key={fed.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedFederacoes.includes(fed.id)
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center ${
                        selectedFederacoes.includes(fed.id)
                          ? 'bg-violet-600'
                          : 'bg-slate-200'
                      }`}
                    >
                      {selectedFederacoes.includes(fed.id) && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedFederacoes.includes(fed.id)}
                      onChange={() => toggleFederacao(fed.id)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800">{fed.nome}</span>
                      <span className="ml-2 text-sm text-slate-500">({fed.sigla})</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {selectedFederacoes.length} de {federacoesDisponiveis.length} selecionadas
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFederacaoModal(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerateComparativePdf}
                    disabled={selectedFederacoes.length < 2}
                    className="px-6 py-2 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-lg font-semibold hover:from-violet-700 hover:to-violet-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Gerar PDF
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}