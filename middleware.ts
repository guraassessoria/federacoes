import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Comparativo - apenas ADMIN e GESTOR
    if (path.startsWith("/dashboard/comparativo")) {
      if (token?.role !== "ADMIN" && token?.role !== "GESTOR") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Rotas de admin - apenas ADMIN
    if (path.startsWith("/admin")) {
      if (token?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/selecionar-empresa", req.url));
      }
    }

    // Rotas de upload - ADMIN e EDITOR
    if (path.startsWith("/upload")) {
      if (token?.role !== "ADMIN" && token?.role !== "EDITOR") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/selecionar-empresa",
    "/admin/:path*",
    "/upload/:path*",
    "/analise/:path*",
    "/demonstracoes/:path*",
    "/liquidez/:path*",
    "/rentabilidade/:path*",
    "/endividamento/:path*",
    "/analise-horizontal/:path*",
    "/analise-vertical/:path*",
  ],
};
