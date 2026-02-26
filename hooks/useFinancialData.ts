"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/lib/contexts/DashboardContext";
import type {
  ProcessedBP,
  ProcessedDRE,
  FinancialIndices,
} from "@/lib/services/financialProcessing";

interface FinancialData {
  bp: ProcessedBP | null;
  dre: ProcessedDRE | null;
  indices: FinancialIndices | null;
  period?: string;
  months?: Array<{ period: string; indices: FinancialIndices }>;
}

interface UseFinancialDataReturn {
  data: FinancialData;
  loading: boolean;
  error: string | null;
  source: "database" | "demonstration" | null;
  message: string | null;
  refresh: () => void;
}

export function useFinancialData(): UseFinancialDataReturn {
  const {
    viewMode,
    selectedYear,
    selectedMonth,
    selectedCompanyId,
    dataVersion,
  } = useDashboard();

  const [data, setData] = useState<FinancialData>({
    bp: null,
    dre: null,
    indices: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"database" | "demonstration" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedCompanyId) {
      setLoading(false);
      setError("Nenhuma empresa selecionada");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        companyId: selectedCompanyId,
        viewMode,
        year: selectedYear,
        month: selectedMonth,
      });

      const response = await fetch(`/api/financial-data?${params}`);
      
      if (!response.ok) {
        throw new Error("Erro ao buscar dados financeiros");
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setSource(result.source);
        setMessage(result.message || null);
      } else {
        throw new Error(result.error || "Erro desconhecido");
      }
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, viewMode, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData, dataVersion]);

  return {
    data,
    loading,
    error,
    source,
    message,
    refresh: fetchData,
  };
}

// Hook auxiliar para formatação de valores
export function useFinancialFormatters() {
  const formatCurrency = useCallback((value: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value); // valores já estão em reais
  }, []);

  const formatPercent = useCallback((value: number): string => {
    return `${value?.toFixed?.(2) ?? "0.00"}%`;
  }, []);

  const formatNumber = useCallback((value: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  }, []);

  return { formatCurrency, formatPercent, formatNumber };
}
