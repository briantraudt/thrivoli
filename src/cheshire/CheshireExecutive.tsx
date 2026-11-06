import { money } from './finance';
import type { CategoryLine } from './executiveView';
import { compactCategoryLines } from './compactCategories';

export function CategoryBoard({ title, lines }: { title: string; lines: CategoryLine[] }) {
  return <section className="ced-board" aria-label={title}>
    <div className="ced-board-head"><h2>{title}</h2></div>
    <dl className="ced-rows ced-category-list">{compactCategoryLines(lines).map(line =>
      <div className="ced-item ced-compact-row" key={line.id}>
        <dt className="ced-name">{line.label}
          {line.badges.length > 0 ? <span className="ced-category-badges">{line.badges.map(badge =>
            <small className="ced-category-badge" key={badge}>{badge}</small>
          )}</span> : null}
        </dt>
        <dd className={`ced-category-value ced-money${line.cents !== null && line.cents < 0 ? ' ced-negative' : ''}`}>
          {line.cents === null ? <span aria-label="Amount unknown">—</span> : money(line.cents)}
        </dd>
      </div>
    )}</dl>
  </section>;
}
