import { Badge } from '@/components/ui/badge';
import { useFirebaseConnection } from '@/hooks/use-firebase';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';

export function FirebaseStatus() {
  const { isConnected, connectionError } = useFirebaseConnection();

  if (connectionError) {
    return (
      <Badge variant="destructive" className="gap-1 print:hidden">
        <XCircle className="h-3 w-3" />
        Firebase Offline
      </Badge>
    );
  }

  if (isConnected) {
    return (
      <Badge variant="default" className="gap-1 bg-green-600 print:hidden">
        <CheckCircle className="h-3 w-3" />
        Firebase Online
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1 print:hidden">
      <Loader2 className="h-3 w-3 animate-spin" />
      Conectando...
    </Badge>
  );
}
