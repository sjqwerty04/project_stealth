import { Loader2 } from 'lucide-react';

export default function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
    </div>
  );
}
