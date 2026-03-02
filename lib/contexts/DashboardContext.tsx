"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type ViewMode = "anual" | "mensal";
type SelectedYear = string;
type SelectedMonth = string;

interface DashboardContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedYear: SelectedYear;
  setSelectedYear: (year: SelectedYear) => void;
  selectedMonth: SelectedMonth;
  setSelectedMonth: (month: SelectedMonth) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  selectedCompanyName: string;
  setSelectedCompanyName: (name: string) => void;
  refreshData: () => void;
  dataVersion: number;
  availableYears: string[];
  availableMonths: { value: string; label: string }[];
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const YEARS = ["2023", "2024", "2025", "2026"];

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("anual");
  const [selectedYear, setSelectedYearState] = useState<string>("2024");
  const [selectedMonth, setSelectedMonthState] = useState<string>("12");
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>("");
  const [dataVersion, setDataVersion] = useState(0);

  // Carregar estado inicial do localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMode = localStorage.getItem("viewMode") as ViewMode;
      const storedYear = localStorage.getItem("selectedYear");
      const storedMonth = localStorage.getItem("selectedMonth");
      const storedCompanyId = localStorage.getItem("selectedCompany");
      const storedCompanyName = localStorage.getItem("selectedCompanyName");

      if (storedMode) setViewModeState(storedMode);
      if (storedYear) setSelectedYearState(storedYear);
      if (storedMonth) setSelectedMonthState(storedMonth);
      if (storedCompanyId) setSelectedCompanyIdState(storedCompanyId);
      if (storedCompanyName) setSelectedCompanyName(storedCompanyName);
    }
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("viewMode", mode);
  }, []);

  const setSelectedYear = useCallback((year: string) => {
    setSelectedYearState(year);
    localStorage.setItem("selectedYear", year);
  }, []);

  const setSelectedMonth = useCallback((month: string) => {
    setSelectedMonthState(month);
    localStorage.setItem("selectedMonth", month);
  }, []);

  const setSelectedCompanyId = useCallback((id: string | null) => {
    setSelectedCompanyIdState(id);
    if (id) {
      localStorage.setItem("selectedCompany", id);
    } else {
      localStorage.removeItem("selectedCompany");
      setSelectedCompanyName("");
      localStorage.removeItem("selectedCompanyName");
    }
  }, []);

  const setSelectedCompanyNameValue = useCallback((name: string) => {
    setSelectedCompanyName(name);
    if (name) {
      localStorage.setItem("selectedCompanyName", name);
    } else {
      localStorage.removeItem("selectedCompanyName");
    }
  }, []);

  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        viewMode,
        setViewMode,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        selectedCompanyId,
        setSelectedCompanyId,
        selectedCompanyName,
        setSelectedCompanyName: setSelectedCompanyNameValue,
        refreshData,
        dataVersion,
        availableYears: YEARS,
        availableMonths: MONTHS,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
