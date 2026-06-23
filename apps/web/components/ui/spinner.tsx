import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A spinning loader. Inherits text color via currentColor. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />;
}
