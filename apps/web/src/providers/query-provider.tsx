'use client';

import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
} from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export default function QueryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Most football data changes at a human timescale; live queries override this.
            staleTime: 5 * 60 * 1000,
            // Keep unused query data in cache for 5 min before GC sweep.
            gcTime: 5 * 60 * 1000,
            placeholderData: keepPreviousData,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
