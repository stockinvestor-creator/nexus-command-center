import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { useWhy } from '@/store/whyStore';
import { WhyPanel } from './WhyPanel';

/** Global drawer — mounted once in the app shell, opened by any WhyButton. */
export function WhyDrawer() {
  const symbol = useWhy((s) => s.symbol);
  const close = useWhy((s) => s.close);
  return (
    <Modal
      open={Boolean(symbol)}
      onClose={close}
      drawer
      title={
        <span className="flex items-center gap-2">
          Why is <span className="font-mono text-neon-cyan">{symbol}</span> moving?
          {symbol && (
            <Link to={`/why?symbol=${symbol}`} onClick={close} className="ml-auto text-[10px] normal-case tracking-normal text-slate-400 hover:text-neon-cyan">
              Open full page
            </Link>
          )}
        </span>
      }
    >
      {symbol && <WhyPanel key={symbol} symbol={symbol} />}
    </Modal>
  );
}
