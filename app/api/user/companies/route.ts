import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (session.user.role === "ADMIN") {
      const companies = await prisma.company.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      });

      return NextResponse.json({
        companies: companies.map((company) => ({
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          role: "ADMIN",
        })),
      });
    }

    const userCompanies = await prisma.userCompany.findMany({
      where: { userId: session.user.id },
      include: {
        company: true,
      },
    });

    const companies = userCompanies.map((uc) => ({
      id: uc.company.id,
      name: uc.company.name,
      cnpj: uc.company.cnpj,
      role: uc.role,
    }));

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Erro ao buscar empresas" },
      { status: 500 }
    );
  }
}
