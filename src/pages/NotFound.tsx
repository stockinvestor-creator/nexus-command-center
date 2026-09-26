import { Link } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <Radar className="h-12 w-12 text-neon-cyan drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
      <h1 className="font-display text-3xl font-bold text-white">404 · Signal lost</h1>
      <p className="text-sm text-slate-500">That route isn&apos;t on the map.</p>
      <Link to="/">
        <Button variant="primary">Back to Command Center</Button>
      </Link>
    </div>
  );
}
