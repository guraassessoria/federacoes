'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnaliseHorizontalPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/analise-horizontal');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-600">Redirecionando...</p>
    </div>
  );
}
