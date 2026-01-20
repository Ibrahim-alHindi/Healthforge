'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        switch (user.role) {
          case 'admin':
            router.push('/dashboard/admin');
            break;
          case 'hospital':
            router.push('/dashboard/hospital');
            break;
          case 'warehouse':
            router.push('/dashboard/warehouse');
            break;
          default:
            router.push('/login');
        }
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );
}
