import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // Create test user (required for testing)
  const testPassword = await bcrypt.hash("johndoe123", 10);
  const testUser = await prisma.user.upsert({
    where: { email: "john@doe.com" },
    update: {},
    create: {
      email: "john@doe.com",
      password: testPassword,
      name: "John Doe",
      role: "ADMIN",
    },
  });
  console.log("Usuário de teste criado:", testUser.email);

  // Create admin user
  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@federacao.com.br" },
    update: { password: adminPassword },
    create: {
      email: "admin@federacao.com.br",
      password: adminPassword,
      name: "Administrador",
      role: "ADMIN",
    },
  });
  console.log("Usuário admin criado:", adminUser.email);

  // Create sample companies
  const companies = [
    { name: "Federação Paulista de Futebol", cnpj: "60.975.827/0001-01" },
    { name: "Federação Mineira de Futebol", cnpj: "17.218.708/0001-60" },
    { name: "Federação Gaúcha de Futebol", cnpj: "92.825.082/0001-00" },
  ];

  for (const company of companies) {
    const created = await prisma.company.upsert({
      where: { cnpj: company.cnpj },
      update: {},
      create: company,
    });
    console.log("Empresa criada:", created.name);

    // Add admin user to all companies
    await prisma.userCompany.upsert({
      where: {
        userId_companyId: {
          userId: adminUser.id,
          companyId: created.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        companyId: created.id,
        role: "ADMIN",
      },
    });

    // Add test user to all companies
    await prisma.userCompany.upsert({
      where: {
        userId_companyId: {
          userId: testUser.id,
          companyId: created.id,
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        companyId: created.id,
        role: "ADMIN",
      },
    });
  }

  console.log("Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
