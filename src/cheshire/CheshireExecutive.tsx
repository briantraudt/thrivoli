import { money } from './finance';
import type { CategoryLine } from './executiveView';

function amount(cents: number) {
  return <span className={cents < 0 ? 'ced-money ced-negative' : 'ced-money'}>{money(cents)}</span>;
}

function Trend({ line }: { line: CategoryLine }) {
  if (!line.trend || line.cents === null || line.priorCents === null) return <span className="ced-muted">—</span>;
  if (line.trend.tone === 'flat') return <span className="ced-muted">{line.trend.text}</span>;
  const change = line.cents - line.priorCents;
  return <span className={change < 0 ? 'ced-negative' : 'ced-up'}>{change > 0 ? '+' : '−'}{money(Math.abs(change))} vs {line.trend.label}</span>;
}

export function CategoryBoard({ title, lines, openId, onOpen }: { title: string; lines: CategoryLine[]; openId: string | null; onOpen: (id: string) => void }) {
  const total = lines.length > 1 && lines.every(line => line.share !== null && line.cents !== null) ? lines.reduce((sum, line) => sum + line.cents!, 0) : null;
  return <section className="ced-board" aria-label={title}>
    <div className="ced-board-head"><h2>{title}</h2>{total !== null ? <span>{money(total)}</span> : null}</div>
    <div className="ced-columns" aria-hidden="true"><span>Category</span><span>Amount</span><span>Share</span><span>Trend</span></div>
    <div className="ced-rows">{lines.map(line => {
      const open = openId === line.id;
      return <div className={open ? 'ced-item ced-open' : 'ced-item'} key={line.id}>
        <button type="button" className="ced-row" aria-expanded={open} onClick={() => onOpen(line.id)}>
          <span className="ced-name">{line.label}</span>
          {line.cents === null ? <span className="ced-wait">{line.waiting}</span> : amount(line.cents)}
          <span className="ced-share"><span className="ced-cell-label">Share</span>{line.share === null ? '—' : new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(line.share)}</span>
          <span className="ced-trend"><span className="ced-cell-label">Trend</span><Trend line={line}/></span>
        </button>
        {open ? <div className="ced-drill" role="region" aria-label={`${line.label} detail`}><p>{line.drill}</p>{line.basis ? <p>{line.basis}</p> : null}</div> : null}
      </div>;
    })}</div>
  </section>;
}
