// Carrega dados diretamente dos arquivos JSON
import resumoExecutivoData from '@/public/data/resumo_executivo.json';
import indicesFinanceirosData from '@/public/data/indices_financeiros.json';
import analiseHorizontalData from '@/public/data/analise_horizontal.json';
import analiseVerticalData from '@/public/data/analise_vertical.json';
import demonstracoesData from '@/public/data/demonstracoes_financeiras.json';

import type {
  ResumoExecutivo,
  IndicesFinanceiros,
  AnaliseHorizontal,
  AnaliseVertical,
  DemonstracoesFinanceiras
} from './types';

export const resumoExecutivo = resumoExecutivoData as ResumoExecutivo;
export const indicesFinanceiros = indicesFinanceirosData as IndicesFinanceiros;
export const analiseHorizontal = analiseHorizontalData as AnaliseHorizontal;
export const analiseVertical = analiseVerticalData as AnaliseVertical;
export const demonstracoesFinanceiras = demonstracoesData as DemonstracoesFinanceiras;

export const anos = ['2023', '2024', '2025'];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value * 1000); // valores estão em milhares
}

export function formatPercent(value: number): string {
  return `${value?.toFixed?.(2) ?? '0.00'}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
}
