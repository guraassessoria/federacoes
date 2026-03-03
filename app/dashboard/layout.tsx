"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardProvider } from "@/lib/contexts/DashboardContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchCompanyName = async () => {
      const companyId = localStorage.getItem("selectedCompany");
      if (companyId) {
        try {
          const res = await fetch(API_ENDPOINTS.USER_COMPANIES);
          const data = await res.json();
          const company = data.companies?.find((c: { id: string }) => c.id === companyId);
          if (company) {
            setCompanyName(company.name);
          }
        } catch (error) {
          console.error("Error fetching company:", error);
        }
      }
    };
    fetchCompanyName();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-slate-50">
        <DashboardSidebar
          userRole={session?.user?.role || "CONSULTA"}
          companyName={companyName}
        />
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
      </div>
    </DashboardProvider>
  );
}
