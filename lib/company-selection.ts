import { API_ENDPOINTS } from "@/lib/constants";

interface Company {
  id: string;
  name: string;
  cnpj?: string | null;
  role?: string;
}

export type CompanyRedirectTarget = "/dashboard" | "/selecionar-empresa";

export async function resolveCompanyRedirect(): Promise<{
  target: CompanyRedirectTarget;
  companies: Company[];
}> {
  try {
    const res = await fetch(API_ENDPOINTS.USER_COMPANIES, { cache: "no-store" });
    if (!res.ok) {
      return { target: "/selecionar-empresa", companies: [] };
    }

    const data = await res.json();
    const companies: Company[] = Array.isArray(data?.companies) ? data.companies : [];

    if (companies.length === 1) {
      const onlyCompany = companies[0];
      if (typeof window !== "undefined") {
        localStorage.setItem("selectedCompany", onlyCompany.id);
        localStorage.setItem("selectedCompanyName", onlyCompany.name);
      }
      return { target: "/dashboard", companies };
    }

    return { target: "/selecionar-empresa", companies };
  } catch {
    return { target: "/selecionar-empresa", companies: [] };
  }
}
