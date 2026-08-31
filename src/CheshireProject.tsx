import { Building2, GraduationCap, Waves } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cheshireSupabase } from "./lib/cheshireSupabase";
import "./cheshire-project.css";
import "./cheshire-workflow.css";
import "./cheshire-layout-fix.css";

type Category = "services" | "revenue" | "labor" | "expenses" | "locationOverhead" | "overhead";
type ChipRow = { id: string; segment_index: number | null; category: Category; value: string; position: number };
const segmentMeta = [
  { name: "Clinics", icon: Building2, tone: "blue" },
  { name: "Schools", icon: GraduationCap, tone: "orange" },
  { name: "Private Programs", icon: Waves, tone: "green" },
] as const;

function Mark() { return <span className="thrivoli-mark" aria-hidden="true">t</span> }
export function PublicHome() { return <main className="public-home"><Link to="/cheshire" className="public-brand" aria-label="Thrivoli"><Mark/><span>thrivoli</span></Link></main> }

function upsertChip(list: ChipRow[], row: ChipRow): ChipRow[] {
  const index = list.findIndex((chip) => chip.id === row.id);
  if (index === -1) return [...list, row];
  const next = list.slice();
  next[index] = row;
  return next;
}
function chipsFor(chips: ChipRow[], segmentIndex: number, category: Category): ChipRow[] {
  return chips.filter((chip) => chip.segment_index === segmentIndex && chip.category === category).sort((a, b) => a.position - b.position);
}
function nextDraftId() { return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// Every input keeps its own local text buffer so a live update from another
// visitor never overwrites what the current person is mid-typing, but still
// applies the moment they aren't focused on that particular chip.
function ChipInput({ chip, label, index, total, onCommit, onDelete }: {
  chip: ChipRow; label: string; index: number; total: number;
  onCommit: (chip: ChipRow, value: string) => void;
  onDelete: (chip: ChipRow) => void;
}) {
  const [value, setValue] = useState(chip.value);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setValue(chip.value) }, [chip.value]);
  return <span className="editable-chip">
    <input
      aria-label={`Edit ${label} item ${index + 1}`}
      value={value}
      placeholder="New item"
      autoFocus={chip.value === "" && index === total - 1}
      size={Math.max(8, value.length || 8)}
      onFocus={() => { editing.current = true }}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur() } }}
      onBlur={() => {
        editing.current = false;
        const trimmed = value.trim();
        if (!trimmed) onDelete(chip);
        else if (trimmed !== chip.value) onCommit(chip, trimmed);
        else if (trimmed !== value) setValue(trimmed);
      }}
    />
    <button type="button" aria-label={`Delete ${value || label} item`} title="Delete item" onClick={() => onDelete(chip)}>×</button>
  </span>;
}
function EditableTags({ items, label, onCommit, onDelete }: {
  items: ChipRow[]; label: string;
  onCommit: (chip: ChipRow, value: string) => void;
  onDelete: (chip: ChipRow) => void;
}) {
  return <div className="tree-tags editable-tags">{items.map((chip, index) =>
    <ChipInput key={chip.id} chip={chip} label={label} index={index} total={items.length} onCommit={onCommit} onDelete={onDelete}/>
  )}</div>;
}
function EditableRow({ label, tone, items, category, segmentIndex, onCommit, onDelete, onAdd }: {
  label: string; tone: string; items: ChipRow[]; category: Category; segmentIndex: number | null;
  onCommit: (chip: ChipRow, value: string) => void;
  onDelete: (chip: ChipRow) => void;
  onAdd: (segmentIndex: number | null, category: Category, items: ChipRow[]) => void;
}) {
  return <section className={`tree-row ${tone}`}>
    <span className="section-type">{label}</span>
    <EditableTags items={items} onCommit={onCommit} onDelete={onDelete} label={label}/>
    <button className="cell-add" type="button" onClick={() => onAdd(segmentIndex, category, items)}>+ Add</button>
  </section>;
}

export function CheshireProject() {
  const [active, setActive] = useState<string | null>(null);
  const [chips, setChips] = useState<ChipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    cheshireSupabase.from("cheshire_chip").select("*").then(({ data, error }) => {
      if (!alive) return;
      if (error) { setSyncError(error.message); setLoading(false); return }
      setChips(((data ?? []) as ChipRow[]).slice().sort((a, b) => a.position - b.position));
      setLoading(false);
    });
    const channel = cheshireSupabase
      .channel("cheshire-chip-board")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cheshire_chip" }, (payload) => {
        setChips((current) => upsertChip(current, payload.new as ChipRow));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cheshire_chip" }, (payload) => {
        setChips((current) => upsertChip(current, payload.new as ChipRow));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cheshire_chip" }, (payload) => {
        const oldId = (payload.old as { id?: string }).id;
        if (oldId) setChips((current) => current.filter((chip) => chip.id !== oldId));
      })
      .subscribe();
    return () => { alive = false; cheshireSupabase.removeChannel(channel) };
  }, []);

  const commitChip = async (chip: ChipRow, value: string) => {
    setChips((current) => current.map((item) => item.id === chip.id ? { ...item, value } : item));
    if (chip.id.startsWith("draft-")) {
      const { data, error } = await cheshireSupabase
        .from("cheshire_chip")
        .insert({ segment_index: chip.segment_index, category: chip.category, value, position: chip.position })
        .select()
        .single();
      if (error) { setSyncError(error.message); setChips((current) => current.filter((item) => item.id !== chip.id)); return }
      setChips((current) => current.map((item) => item.id === chip.id ? (data as ChipRow) : item));
    } else {
      const { error } = await cheshireSupabase.from("cheshire_chip").update({ value }).eq("id", chip.id);
      if (error) setSyncError(error.message);
    }
  };
  const deleteChip = async (chip: ChipRow) => {
    setChips((current) => current.filter((item) => item.id !== chip.id));
    if (chip.id.startsWith("draft-")) return;
    const { error } = await cheshireSupabase.from("cheshire_chip").delete().eq("id", chip.id);
    if (error) setSyncError(error.message);
  };
  const addDraftChip = (segmentIndex: number | null, category: Category, items: ChipRow[]) => {
    const position = items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    setChips((current) => [...current, { id: nextDraftId(), segment_index: segmentIndex, category, value: "", position }]);
  };

  if (loading) return <main className="tree-page"><p className="cheshire-loading">Loading the shared profitability map…</p></main>;

  const overheadChips = chips.filter((chip) => chip.category === "overhead").sort((a, b) => a.position - b.position);
  const overheadColumns = [0, 1, 2].map((column) => overheadChips.filter((_, index) => index % 3 === column));

  return <main className="tree-page"><section className="tree-canvas" aria-label="Cheshire profitability model">
    <div className="tree-top">
      <div className="tree-root"><strong>Profitability Map</strong></div>
      <div className="tree-legend" aria-label="Color legend"><span className="revenue-key">Revenue</span><span className="expense-key">Expenses</span><span className="overhead-key">Overhead</span></div>
    </div>
    {syncError && <p role="alert" className="cheshire-sync-error">Live sync is having trouble ({syncError}). Recent edits may not be saved for everyone.</p>}
    <div className="map-frame"><div className="tree-columns">{segmentMeta.map((segment, index) => <article className={`tree-card ${segment.tone} ${active && active !== segment.name ? "is-muted" : ""} ${active === segment.name ? "is-active" : ""}`} key={segment.name}>
      <button className="tree-card-header" type="button" aria-pressed={active === segment.name} onClick={() => setActive(active === segment.name ? null : segment.name)}><segment.icon size={21} aria-hidden="true"/><div className="segment-title"><h2>{segment.name}</h2></div></button>
      <EditableRow label="Service" tone="service" category="services" segmentIndex={index} items={chipsFor(chips, index, "services")} onCommit={commitChip} onDelete={deleteChip} onAdd={addDraftChip}/>
      <EditableRow label="Payer" tone="revenue-source" category="revenue" segmentIndex={index} items={chipsFor(chips, index, "revenue")} onCommit={commitChip} onDelete={deleteChip} onAdd={addDraftChip}/>
      <EditableRow label="Expense · Labor" tone="cost" category="labor" segmentIndex={index} items={chipsFor(chips, index, "labor")} onCommit={commitChip} onDelete={deleteChip} onAdd={addDraftChip}/>
      <EditableRow label="Expense · Operations" tone="cost" category="expenses" segmentIndex={index} items={chipsFor(chips, index, "expenses")} onCommit={commitChip} onDelete={deleteChip} onAdd={addDraftChip}/>
      <EditableRow label="Location Overhead" tone="location-overhead" category="locationOverhead" segmentIndex={index} items={chipsFor(chips, index, "locationOverhead")} onCommit={commitChip} onDelete={deleteChip} onAdd={addDraftChip}/>
    </article>)}</div>
    <section className="tree-bottom"><div className="shared-costs"><h2>Centralized Shared Overhead</h2><div className="overhead-columns">{overheadColumns.map((items, column) => <div className={"overhead-cell overhead-cell-" + (column + 1)} key={column}><EditableTags items={items} onCommit={commitChip} onDelete={deleteChip} label="Centralized Shared Overhead"/></div>)}</div><button className="cell-add" type="button" onClick={() => addDraftChip(null, "overhead", overheadChips)}>+ Add</button></div></section></div>
  </section></main>;
}
