"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

type Column = { id: string; name: string; type: string; pk?: boolean; nullable?: boolean };
type Entity = { id: string; name: string; x: number; y: number; columns: Column[] };
type Relation = { id: string; from: string; to: string; label: string };
type Decoration = { id: string; kind: "note" | "text" | "frame"; x: number; y: number; content: string };
type LinkPreview = { from: string; sx: number; sy: number; x: number; y: number; direction: 1 | -1 };
type ToolMode = "select" | "relation";

const WORLD_W = 1500;
const WORLD_H = 1000;
const CARD_W = 310;
const typeOptions = ["UUID", "VARCHAR(255)", "CHAR(1)", "TEXT", "SMALLINT", "INTEGER", "BIGINT", "SERIAL", "BIGSERIAL", "NUMERIC(10,2)", "REAL", "DOUBLE PRECISION", "BOOLEAN", "DATE", "TIME", "TIMESTAMP", "TIMESTAMPTZ", "JSON", "JSONB", "BYTEA"];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    cursor: <><path d="m5 3 14 10-7 1-3 7L5 3Z" /><path d="m12 14 5 6" /></>,
    table: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M3.5 9h17M9 9v11" /></>,
    relation: <><circle cx="6" cy="12" r="3" /><circle cx="18" cy="12" r="3" /><path d="M9 12h6M12 9l3 3-3 3" /></>,
    note: <><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4M8 12h8M8 16h6" /></>,
    text: <><path d="M4 6h16M12 6v13M8 19h8" /><path d="M8 6l4-3 4 3" /></>,
    frame: <><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2" /><path d="M8 9h8" /></>,
    arrange: <><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="9" y="14.5" width="6" height="6" rx="1" /><path d="M9.5 6.5h5M6.5 9.5v3h5.5v2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v3h14v-3" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  };
  return <svg {...common}>{paths[name] ?? paths.plus}</svg>;
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type ExportTarget = "sql" | "mongodb" | "supabase";

function quoteIdentifier(value: string) {
  return `"${(value || "unnamed").replaceAll('"', '""')}"`;
}

function singularize(value: string) {
  if (value.toLowerCase().endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.toLowerCase().endsWith("s") && !/(ss|us|is)$/i.test(value)) return value.slice(0, -1);
  return value;
}

function relationFieldName(entity: Entity) {
  return `${singularize(entity.name || "table")}_id`;
}

function primaryColumn(entity: Entity) {
  return entity.columns.find((column) => column.pk);
}

function postgresScript(entities: Entity[], relations: Relation[], supabase = false) {
  const schemaPrefix = supabase ? "public." : "";
  const tableRef = (name: string) => `${schemaPrefix}${quoteIdentifier(name)}`;
  const notes: string[] = [];
  const statements: string[] = [];
  const relationConstraints: string[] = [];

  for (const entity of entities) {
    const definitions = entity.columns.map((column) => `  ${quoteIdentifier(column.name)} ${column.type}${column.nullable ? "" : " NOT NULL"}`);
    const constraints: string[] = [];
    const primaryKeys = entity.columns.filter((column) => column.pk);
    if (primaryKeys.length) constraints.push(`  PRIMARY KEY (${primaryKeys.map((column) => quoteIdentifier(column.name)).join(", ")})`);

    const incoming = relations.filter((relation) => relation.to === entity.id && relation.label !== "N : M");
    for (const relation of incoming) {
      const source = entities.find((item) => item.id === relation.from);
      const sourceKey = source && primaryColumn(source);
      if (!source || !sourceKey) {
        notes.push(`-- Relation ${source?.name ?? relation.from} -> ${entity.name}: choose a PK on the source table before adding its foreign key.`);
        continue;
      }
      const fieldName = relationFieldName(source);
      if (!entity.columns.some((column) => column.name === fieldName)) {
        definitions.push(`  ${quoteIdentifier(fieldName)} ${sourceKey.type}`);
      }
      relationConstraints.push(`ALTER TABLE ${tableRef(entity.name)} ADD FOREIGN KEY (${quoteIdentifier(fieldName)}) REFERENCES ${tableRef(source.name)} (${quoteIdentifier(sourceKey.name)});`);
      if (relation.label === "1 : 1") relationConstraints.push(`ALTER TABLE ${tableRef(entity.name)} ADD UNIQUE (${quoteIdentifier(fieldName)});`);
    }

    statements.push(`CREATE TABLE IF NOT EXISTS ${tableRef(entity.name)} (\n${[...definitions, ...constraints].join(",\n")}\n);`);
  }

  const seenJoinTables = new Set<string>();
  for (const relation of relations.filter((item) => item.label === "N : M")) {
    const from = entities.find((entity) => entity.id === relation.from);
    const to = entities.find((entity) => entity.id === relation.to);
    const fromKey = from && primaryColumn(from);
    const toKey = to && primaryColumn(to);
    if (!from || !to || !fromKey || !toKey) {
      notes.push(`-- N:M relation ${from?.name ?? relation.from} <-> ${to?.name ?? relation.to}: choose a PK on both tables before creating a join table.`);
      continue;
    }
    const joinName = `${from.name}_${to.name}`;
    if (seenJoinTables.has(joinName)) continue;
    seenJoinTables.add(joinName);
    const fromField = relationFieldName(from);
    const toField = relationFieldName(to);
    statements.push(`CREATE TABLE IF NOT EXISTS ${tableRef(joinName)} (\n  ${quoteIdentifier(fromField)} ${fromKey.type} NOT NULL,\n  ${quoteIdentifier(toField)} ${toKey.type} NOT NULL,\n  PRIMARY KEY (${quoteIdentifier(fromField)}, ${quoteIdentifier(toField)}),\n  FOREIGN KEY (${quoteIdentifier(fromField)}) REFERENCES ${tableRef(from.name)} (${quoteIdentifier(fromKey.name)}),\n  FOREIGN KEY (${quoteIdentifier(toField)}) REFERENCES ${tableRef(to.name)} (${quoteIdentifier(toKey.name)})\n);`);
  }

  const header = supabase
    ? "-- Supabase SQL (run in the SQL Editor; tables are created in the public schema)."
    : "-- PostgreSQL DDL generated from the ERD diagram.";
  return [header, ...notes, ...statements, ...relationConstraints].join("\n\n");
}

function bsonType(type: string) {
  const normalized = type.toUpperCase();
  if (/UUID|CHAR|TEXT|VARCHAR/.test(normalized)) return "string";
  if (/BIGINT|BIGSERIAL/.test(normalized)) return "long";
  if (/SMALLINT|^INT$|INTEGER|^SERIAL$/.test(normalized)) return "int";
  if (/NUMERIC|DECIMAL/.test(normalized)) return "decimal";
  if (/REAL|DOUBLE|FLOAT/.test(normalized)) return "double";
  if (/BOOL/.test(normalized)) return "bool";
  if (/TIMESTAMP|^DATE$/.test(normalized)) return "date";
  if (/^TIME/.test(normalized)) return "string";
  if (/JSON/.test(normalized)) return "object";
  if (/BYTEA/.test(normalized)) return "binData";
  return "string";
}

function mongoScript(entities: Entity[], relations: Relation[], projectName: string) {
  const databaseName = (projectName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "erd_database");
  const blocks = [`// MongoDB shell script generated from the ERD.`, `const erdDb = db.getSiblingDB(${JSON.stringify(databaseName)});`];
  const indexes: string[] = [];

  for (const entity of entities) {
    const properties: Record<string, { bsonType: string }> = {};
    const required: string[] = [];
    for (const column of entity.columns) {
      properties[column.name || "column_name"] = { bsonType: bsonType(column.type) };
      if (!column.nullable) required.push(column.name || "column_name");
      if (column.pk) indexes.push(`erdDb.getCollection(${JSON.stringify(entity.name)}).createIndex({ ${JSON.stringify(column.name)}: 1 }, { unique: true });`);
    }

    for (const relation of relations.filter((item) => item.to === entity.id && item.label !== "N : M")) {
      const source = entities.find((item) => item.id === relation.from);
      if (!source) continue;
      const fieldName = relationFieldName(source);
      properties[fieldName] ??= { bsonType: "objectId" };
      const unique = relation.label === "1 : 1" ? ", { unique: true }" : "";
      indexes.push(`erdDb.getCollection(${JSON.stringify(entity.name)}).createIndex({ ${JSON.stringify(fieldName)}: 1 }${unique});`);
    }

    const schema = { bsonType: "object", properties, ...(required.length ? { required } : {}) };
    blocks.push(`erdDb.createCollection(${JSON.stringify(entity.name)}, {\n  validator: {\n    $jsonSchema: ${JSON.stringify(schema, null, 2).replaceAll("\n", "\n    ")}\n  }\n});`);
  }

  const seenJoinTables = new Set<string>();
  for (const relation of relations.filter((item) => item.label === "N : M")) {
    const from = entities.find((entity) => entity.id === relation.from);
    const to = entities.find((entity) => entity.id === relation.to);
    if (!from || !to) continue;
    const joinName = `${from.name}_${to.name}`;
    if (seenJoinTables.has(joinName)) continue;
    seenJoinTables.add(joinName);
    const fromField = relationFieldName(from);
    const toField = relationFieldName(to);
    const properties = { [fromField]: { bsonType: "objectId" }, [toField]: { bsonType: "objectId" } };
    blocks.push(`erdDb.createCollection(${JSON.stringify(joinName)}, {\n  validator: { $jsonSchema: ${JSON.stringify({ bsonType: "object", properties, required: [fromField, toField] })} }\n});`);
    indexes.push(`erdDb.getCollection(${JSON.stringify(joinName)}).createIndex({ ${JSON.stringify(fromField)}: 1, ${JSON.stringify(toField)}: 1 }, { unique: true });`);
  }

  if (indexes.length) blocks.push(`// Primary-key and relationship indexes.\n${indexes.join("\n")}`);
  return blocks.join("\n\n");
}

export default function ErdEditor({ diagramId }: { diagramId: string }) {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [mode, setMode] = useState<ToolMode>("select");
  const [relationType, setRelationType] = useState("1 : N");
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const [projectName, setProjectName] = useState("");
  const [gridVisible, setGridVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTarget>("sql");
  const [exportCopied, setExportCopied] = useState(false);
  const [saved, setSaved] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const dragRef = useRef<{ id: string; target: "entity" | "decoration"; pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const relationDragRef = useRef<{ from: string; pointerId: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loadDiagram = async () => {
      try {
        const response = await fetch(`/api/diagrams/${diagramId}`, { cache: "no-store" });
        if (response.status === 401) { router.replace("/login"); return; }
        if (response.status === 404) { router.replace("/"); return; }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Không thể mở sơ đồ.");
        const payload = {
          name: result.name as string,
          entities: Array.isArray(result.entities) ? result.entities as Entity[] : [],
          relations: Array.isArray(result.relations) ? result.relations as Relation[] : [],
          decorations: Array.isArray(result.decorations) ? result.decorations as Decoration[] : [],
        };
        if (!active) return;
        lastSavedRef.current = JSON.stringify(payload);
        setProjectName(payload.name);
        setEntities(payload.entities);
        setRelations(payload.relations);
        setDecorations(payload.decorations);
        setSaved("saved");
        setReady(true);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Không thể mở sơ đồ.");
      }
    };
    void loadDiagram();
    return () => { active = false; };
  }, [diagramId, router]);

  useEffect(() => {
    if (!ready) return;
    const payload = { name: projectName.trim(), entities, relations, decorations };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return;
    if (!payload.name) { setSaved("error"); return; }
    setSaved("saving");
    let active = true;
    const timer = window.setTimeout(() => {
      const queuedSave = saveQueueRef.current.then(async () => {
        if (!active) return;
        try {
          const response = await fetch(`/api/diagrams/${diagramId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: serialized,
          });
          if (response.status === 401) { router.replace("/login"); return; }
          if (!response.ok) throw new Error("Lưu sơ đồ thất bại.");
          lastSavedRef.current = serialized;
          if (active) setSaved("saved");
        } catch {
          if (active) setSaved("error");
        }
      });
      saveQueueRef.current = queuedSave;
    }, 650);
    return () => { active = false; window.clearTimeout(timer); };
  }, [diagramId, entities, relations, decorations, projectName, ready, router]);

  const addEntity = useCallback(() => {
    const id = makeId();
    const idColumnId = makeId();
    const createdAtId = makeId();
    const bounds = viewportRef.current;
    const centerX = bounds ? (bounds.scrollLeft + bounds.clientWidth / 2) / zoom : WORLD_W / 2;
    const centerY = bounds ? (bounds.scrollTop + bounds.clientHeight / 2) / zoom : WORLD_H / 2;
    const offset = (entities.length % 4) * 30;
    setEntities((current) => [...current, {
      id, name: `new_table_${current.length + 1}`, x: Math.max(24, Math.min(WORLD_W - CARD_W - 24, centerX - CARD_W / 2 + offset)), y: Math.max(24, Math.min(WORLD_H - 250, centerY - 100 + offset)),
      columns: [
        { id: idColumnId, name: "id", type: "UUID", pk: false },
        { id: createdAtId, name: "created_at", type: "TIMESTAMP" },
      ],
    }]);
    setMode("select");
  }, [entities.length, zoom]);

  const addDecoration = (kind: Decoration["kind"]) => {
    const id = makeId();
    const bounds = viewportRef.current;
    const centerX = bounds ? (bounds.scrollLeft + bounds.clientWidth / 2) / zoom : WORLD_W / 2;
    const centerY = bounds ? (bounds.scrollTop + bounds.clientHeight / 2) / zoom : WORLD_H / 2;
    const offset = (decorations.length % 5) * 26;
    const content = kind === "note" ? "Ghi chú mới..." : kind === "frame" ? "Nhóm mới" : "Văn bản mới";
    setDecorations((current) => [...current, { id, kind, x: Math.max(20, centerX - 115 + offset), y: Math.max(20, centerY - 60 + offset), content }]);
    setMode("select");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (exportOpen) {
        if (event.key === "Escape") setExportOpen(false);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "v") { setMode("select"); setLinkPreview(null); relationDragRef.current = null; }
      if (key === "t") addEntity();
      if (key === "r") { setMode("relation"); setLinkPreview(null); }
      if (key === "n") addDecoration("note");
      if (key === "a") addDecoration("text");
      if (key === "g") addDecoration("frame");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addEntity, decorations.length, exportOpen, zoom]);

  const updateEntity = (id: string, patch: Partial<Entity>) => setEntities((current) => current.map((entity) => entity.id === id ? { ...entity, ...patch } : entity));
  const updateDecoration = (id: string, patch: Partial<Decoration>) => setDecorations((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateColumn = (entityId: string, columnId: string, patch: Partial<Column>) => {
    setEntities((current) => current.map((entity) => entity.id === entityId
      ? { ...entity, columns: entity.columns.map((column) => column.id === columnId ? { ...column, ...patch } : column) }
      : entity));
  };

  const deleteEntity = (id: string) => {
    setEntities((current) => current.filter((entity) => entity.id !== id));
    setRelations((current) => current.filter((relation) => relation.from !== id && relation.to !== id));
    if (relationDragRef.current?.from === id) {
      relationDragRef.current = null;
      setLinkPreview(null);
    }
  };

  const deleteDecoration = (id: string) => setDecorations((current) => current.filter((item) => item.id !== id));

  const arrangeEntities = () => setEntities((current) => current.map((entity, index) => ({
    ...entity,
    x: 90 + (index % 3) * 390,
    y: 100 + Math.floor(index / 3) * 360,
  })));

  const exportCode = useMemo(() => exportTarget === "mongodb"
    ? mongoScript(entities, relations, projectName)
    : postgresScript(entities, relations, exportTarget === "supabase"), [entities, relations, projectName, exportTarget]);

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportCode);
      setExportCopied(true);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = exportCode;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setExportCopied(true);
    }
  };

  const downloadExport = () => {
    const isMongo = exportTarget === "mongodb";
    const blob = new Blob([exportCode], { type: isMongo ? "application/javascript;charset=utf-8" : "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${projectName.trim().replace(/[^a-z0-9-_]+/gi, "-") || "database"}.${isMongo ? "js" : "sql"}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const relationDrag = relationDragRef.current;
    if (relationDrag?.pointerId === event.pointerId) {
      const source = entities.find((entity) => entity.id === relationDrag.from);
      const viewport = viewportRef.current;
      if (!source || !viewport) return;
      const bounds = viewport.getBoundingClientRect();
      const x = (event.clientX - bounds.left + viewport.scrollLeft) / zoom;
      const y = (event.clientY - bounds.top + viewport.scrollTop) / zoom;
      const direction = x >= source.x + CARD_W / 2 ? 1 : -1;
      setLinkPreview({ from: source.id, sx: source.x + (direction > 0 ? CARD_W : 0), sy: source.y + 44 + source.columns.length * 14.5, x, y, direction });
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.x) / zoom;
    const dy = (event.clientY - drag.y) / zoom;
    if (drag.target === "entity") {
      setEntities((current) => current.map((entity) => entity.id === drag.id
          ? { ...entity, x: Math.max(0, Math.min(WORLD_W - CARD_W, drag.originX + dx)), y: Math.max(0, Math.min(WORLD_H - 100, drag.originY + dy)) }
        : entity));
    } else {
      setDecorations((current) => current.map((item) => item.id === drag.id
        ? { ...item, x: Math.max(0, Math.min(WORLD_W - (item.kind === "frame" ? 400 : 240), drag.originX + dx)), y: Math.max(0, Math.min(WORLD_H - (item.kind === "frame" ? 280 : 180), drag.originY + dy)) }
        : item));
    }
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const relationDrag = relationDragRef.current;
    if (relationDrag?.pointerId === event.pointerId) {
      if (event.type !== "pointercancel") {
        const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-entity-id]");
        const to = targetElement?.dataset.entityId;
        if (to && to !== relationDrag.from) {
          setRelations((current) => [...current, { id: makeId(), from: relationDrag.from, to, label: relationType }]);
        }
      }
      relationDragRef.current = null;
      setLinkPreview(null);
    }
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const exportHint = entities.length === 1 ? "1 bảng" : `${entities.length} bảng`;

  if (!ready) {
    return <div className="editor-loading"><div className="loading-brand"><Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized /></div>
      {loadError ? <><h1>Không mở được sơ đồ</h1><p>{loadError}</p><Link href="/">Về danh sách sơ đồ</Link></> : <><span className="loading-spinner" /><p>Đang tải sơ đồ…</p></>}
    </div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-logo-frame">
            <Image className="brand-logo" src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized />
          </div>
          <span className="brand-divider" />
          <div className="breadcrumb"><Link href="/">Sơ đồ của tôi</Link><Icon name="chevron" size={14} /><strong>{projectName}</strong></div>
        </div>
        <div className="topbar-right">
          <div className="save-state"><span className={`save-dot ${saved === "saved" ? "is-saved" : saved === "error" ? "has-error" : ""}`} />{saved === "saved" ? "Đã lưu" : saved === "saving" ? "Đang lưu" : "Lỗi lưu"}</div>
          <span className="topbar-separator" />
          <button className="logout-button" type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
          <button className="share-button" type="button" onClick={() => { setExportOpen(true); setExportCopied(false); }} disabled={entities.length === 0} title={entities.length === 0 ? "Thêm bảng trước khi xuất mã" : "Xem và xuất mã tạo cơ sở dữ liệu"}><Icon name="download" size={16} /> Xuất mã</button>
        </div>
      </header>

      <section className="projectbar">
        <div className="project-meta">
          <div className="project-icon"><Icon name="grid" size={19} /></div>
          <div className="project-title-group">
            <input className="project-title" value={projectName} maxLength={100} onChange={(event) => setProjectName(event.target.value)} onBlur={() => setProjectName((name) => name.trim() || "Sơ đồ không tên")} aria-label="Tên sơ đồ" />
            <span className="project-subtitle">Sơ đồ cơ sở dữ liệu <span className="meta-dot">·</span> Lưu tự động</span>
          </div>
        </div>
        <div className="project-actions">
          <button className={`tool-button ${mode === "select" ? "active" : ""}`} onClick={() => { setMode("select"); setLinkPreview(null); relationDragRef.current = null; }} title="Chọn và di chuyển" type="button">
            <Icon name="cursor" size={17} /><span>Chọn</span><kbd>V</kbd>
          </button>
          <button className="tool-button" onClick={addEntity} title="Thêm bảng" type="button"><Icon name="table" size={17} /><span>Bảng mới</span><kbd>T</kbd></button>
          <button className={`tool-button ${mode === "relation" ? "active" : ""}`} onClick={() => { setMode("relation"); setLinkPreview(null); }} title="Kéo từ bảng nguồn sang bảng đích để nối" type="button">
            <Icon name="relation" size={17} /><span>Quan hệ</span><kbd>R</kbd>
          </button>
          <select className="relation-type" aria-label="Kiểu quan hệ mới" title="Chọn kiểu quan hệ" value={relationType} onChange={(event) => setRelationType(event.target.value)}>
            <option value="1 : 1">1 : 1</option><option value="1 : N">1 : N</option><option value="N : M">N : M</option>
          </select>
          <span className="tool-divider" />
          <button className="tool-button" onClick={() => addDecoration("note")} title="Thêm ghi chú" type="button"><Icon name="note" size={17} /><span>Ghi chú</span><kbd>N</kbd></button>
          <button className="tool-button" onClick={() => addDecoration("text")} title="Thêm văn bản" type="button"><Icon name="text" size={17} /><span>Văn bản</span><kbd>A</kbd></button>
          <button className="tool-button" onClick={() => addDecoration("frame")} title="Thêm khung nhóm" type="button"><Icon name="frame" size={17} /><span>Nhóm</span><kbd>G</kbd></button>
          <span className="tool-divider" />
          <button className="tool-button arrange-button" onClick={arrangeEntities} title="Sắp xếp bảng" type="button"><Icon name="arrange" size={17} /><span>Sắp xếp</span></button>
          <div className="zoom-control">
            <button type="button" className="icon-button" aria-label="Thu nhỏ" onClick={() => setZoom((current) => Math.max(0.55, Math.round((current - 0.1) * 100) / 100))}><Icon name="minus" size={16} /></button>
            <button type="button" className="zoom-value" onClick={() => setZoom(0.9)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className="icon-button" aria-label="Phóng to" onClick={() => setZoom((current) => Math.min(1.4, Math.round((current + 0.1) * 100) / 100))}><Icon name="plus" size={16} /></button>
          </div>
        </div>
      </section>

      <main className={`canvas-viewport ${mode === "relation" ? "link-mode" : ""}`} ref={viewportRef} onPointerMove={onCanvasPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
        <div className="canvas-stage" style={{ width: WORLD_W * zoom, height: WORLD_H * zoom }}>
          <div className={`canvas-world ${gridVisible ? "grid-on" : ""}`} style={{ width: WORLD_W, height: WORLD_H, transform: `scale(${zoom})` }}>
            <svg className="relations-layer" width={WORLD_W} height={WORLD_H} aria-label="Các quan hệ giữa bảng">
              <defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3 z" fill="#8ea3bd" /></marker></defs>
              {relations.map((relation) => {
                const from = entities.find((entity) => entity.id === relation.from);
                const to = entities.find((entity) => entity.id === relation.to);
                if (!from || !to) return null;
                const direction = to.x >= from.x ? 1 : -1;
                const sx = from.x + (direction > 0 ? CARD_W : 0);
                const sy = from.y + 44 + from.columns.length * 14.5;
                const ex = to.x + (direction > 0 ? 0 : CARD_W);
                const ey = to.y + 44 + to.columns.length * 14.5;
                const distance = Math.max(65, Math.abs(ex - sx) * 0.42);
                const [fromCardinality = "1", toCardinality = "N"] = relation.label.split(":").map((part) => part.trim());
                const path = relation.label === "1 : 1"
                  ? `M ${sx} ${sy} L ${ex} ${ey}`
                  : `M ${sx} ${sy} C ${sx + distance * direction} ${sy}, ${ex - distance * direction} ${ey}, ${ex} ${ey}`;
                return <g key={relation.id}>
                  <path className="relation-halo" d={path} />
                  <path className="relation-line" markerStart={relation.label === "N : M" ? "url(#arrowhead)" : undefined} markerEnd={relation.label === "1 : N" || relation.label === "N : M" ? "url(#arrowhead)" : undefined} d={path} />
                  <g className="endpoint-label" transform={`translate(${sx + direction * 18}, ${sy - 15})`}><rect x="-11" y="-9" width="22" height="18" rx="6" /><text textAnchor="middle" dominantBaseline="central">{fromCardinality}</text></g>
                  <g className="endpoint-label" transform={`translate(${ex - direction * 18}, ${ey - 15})`}><rect x="-11" y="-9" width="22" height="18" rx="6" /><text textAnchor="middle" dominantBaseline="central">{toCardinality}</text></g>
                </g>;
              })}
              {linkPreview && <path className="relation-preview" d={`M ${linkPreview.sx} ${linkPreview.sy} C ${linkPreview.sx + linkPreview.direction * 70} ${linkPreview.sy}, ${linkPreview.x - linkPreview.direction * 70} ${linkPreview.y}, ${linkPreview.x} ${linkPreview.y}`} />}
            </svg>
            {decorations.map((item) => (
              <div key={item.id} className={`canvas-decoration decor-${item.kind}`} style={{ left: item.x, top: item.y }} onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button,input,textarea")) return;
                dragRef.current = { id: item.id, target: "decoration", pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: item.x, originY: item.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}>
                {item.kind === "note" && <>
                  <div className="note-heading"><Icon name="note" size={14} /><span>GHI CHÚ</span><button type="button" aria-label="Xóa ghi chú" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); deleteDecoration(item.id); }}><Icon name="close" size={13} /></button></div>
                  <textarea value={item.content} aria-label="Nội dung ghi chú" onChange={(event) => updateDecoration(item.id, { content: event.target.value })} onPointerDown={(event) => event.stopPropagation()} />
                </>}
                {item.kind === "text" && <>
                  <input className="decor-text-input" value={item.content} aria-label="Văn bản trên sơ đồ" onChange={(event) => updateDecoration(item.id, { content: event.target.value })} onPointerDown={(event) => event.stopPropagation()} />
                  <button type="button" className="decor-delete" aria-label="Xóa văn bản" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); deleteDecoration(item.id); }}><Icon name="close" size={13} /></button>
                </>}
                {item.kind === "frame" && <>
                  <div className="frame-heading"><span className="frame-grip">⠿</span><input value={item.content} aria-label="Tên nhóm" onChange={(event) => updateDecoration(item.id, { content: event.target.value })} onPointerDown={(event) => event.stopPropagation()} /><button type="button" aria-label="Xóa khung nhóm" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); deleteDecoration(item.id); }}><Icon name="close" size={13} /></button></div>
                  <span className="frame-caption">Kéo bảng vào vùng này để nhóm</span>
                </>}
              </div>
            ))}
            {entities.map((entity) => (
              <article key={entity.id} data-entity-id={entity.id} className={`entity-card ${linkPreview?.from === entity.id ? "relation-origin" : ""}`} style={{ left: entity.x, top: entity.y }} onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button,input,select")) return;
                if (mode === "relation") {
                  relationDragRef.current = { from: entity.id, pointerId: event.pointerId };
                  const viewport = viewportRef.current;
                  if (viewport) {
                    const bounds = viewport.getBoundingClientRect();
                    const x = (event.clientX - bounds.left + viewport.scrollLeft) / zoom;
                    const y = (event.clientY - bounds.top + viewport.scrollTop) / zoom;
                    const direction = x >= entity.x + CARD_W / 2 ? 1 : -1;
                    setLinkPreview({ from: entity.id, sx: entity.x + (direction > 0 ? CARD_W : 0), sy: entity.y + 44 + entity.columns.length * 14.5, x, y, direction });
                  }
                  event.currentTarget.setPointerCapture(event.pointerId);
                  event.preventDefault();
                  return;
                }
                dragRef.current = { id: entity.id, target: "entity", pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: entity.x, originY: entity.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}>
                <div className="entity-heading">
                  <div className="entity-table-icon"><Icon name="table" size={15} /></div>
                  <input className="entity-name" value={entity.name} onChange={(event) => updateEntity(entity.id, { name: event.target.value })} aria-label={`Tên bảng ${entity.name}`} onPointerDown={(event) => event.stopPropagation()} />
                  <span className="entity-menu-dot">•••</span>
                  <button type="button" className="entity-delete" title="Xóa bảng" aria-label={`Xóa bảng ${entity.name}`} onClick={() => deleteEntity(entity.id)}><Icon name="trash" size={15} /></button>
                </div>
                <div className="column-list">
                  {entity.columns.map((column) => (
                    <div className="column-row" key={column.id}>
                      <input className="column-name" value={column.name} aria-label="Tên cột" onChange={(event) => updateColumn(entity.id, column.id, { name: event.target.value })} onPointerDown={(event) => event.stopPropagation()} />
                      <select className="column-type" aria-label={`Kiểu dữ liệu ${column.name}`} title={column.type} value={column.type} onChange={(event) => updateColumn(entity.id, column.id, { type: event.target.value })} onPointerDown={(event) => event.stopPropagation()}>
                        {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <select className={`column-key ${column.pk ? "is-primary" : ""}`} aria-label={`Khóa chính ${column.name}`} title="Chọn cột làm khóa chính" value={column.pk ? "PK" : "NONE"} onChange={(event) => updateColumn(entity.id, column.id, { pk: event.target.value === "PK" })} onPointerDown={(event) => event.stopPropagation()}>
                        <option value="NONE">—</option><option value="PK">PK</option>
                      </select>
                      <button type="button" className="column-remove" aria-label={`Xóa cột ${column.name}`} title="Xóa cột" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); updateEntity(entity.id, { columns: entity.columns.filter((item) => item.id !== column.id) }); }}><Icon name="close" size={12} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="add-column" onClick={(event) => { event.stopPropagation(); updateEntity(entity.id, { columns: [...entity.columns, { id: makeId(), name: "new_column", type: "VARCHAR(255)" }] }); }}>
                  <Icon name="plus" size={14} /><span>Thêm cột</span>
                </button>
              </article>
            ))}
            {entities.length === 0 && decorations.length === 0 && <div className="empty-canvas"><div className="empty-icon"><Icon name="table" size={24} /></div><h2>Sơ đồ đang trống</h2><p>Chọn thành phần trên thanh công cụ để bắt đầu thiết kế.</p><button type="button" className="primary-button" onClick={addEntity}><Icon name="plus" size={16} /> Thêm bảng đầu tiên</button></div>}
          </div>
        </div>
        {mode === "relation" && <div className="canvas-tip"><span className="tip-pulse" />Kéo từ bảng nguồn sang bảng đích để nối<button type="button" aria-label="Thoát chế độ tạo quan hệ" onClick={() => { setMode("select"); relationDragRef.current = null; setLinkPreview(null); }}><Icon name="close" size={15} /></button></div>}
        <div className="canvas-controls">
          <button type="button" className={`canvas-control ${gridVisible ? "selected" : ""}`} title="Bật/tắt lưới" onClick={() => setGridVisible((visible) => !visible)}><Icon name="grid" size={16} /></button>
          <span className="control-separator" />
          <button type="button" className="fit-control" onClick={() => { setZoom(0.9); viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); }}>Vừa khung</button>
        </div>
      </main>

      {exportOpen && <div className="export-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportOpen(false); }}>
        <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <header className="export-header">
            <div><h2 id="export-title">Xuất lệnh tạo cơ sở dữ liệu</h2><p>Chọn nền tảng, xem trước mã rồi sao chép hoặc tải tệp.</p></div>
            <button type="button" className="export-close" aria-label="Đóng" onClick={() => setExportOpen(false)}><Icon name="close" size={18} /></button>
          </header>
          <div className="export-tabs" role="tablist" aria-label="Nền tảng cơ sở dữ liệu">
            <button type="button" role="tab" aria-selected={exportTarget === "sql"} className={exportTarget === "sql" ? "active" : ""} onClick={() => { setExportTarget("sql"); setExportCopied(false); }}>SQL / PostgreSQL</button>
            <button type="button" role="tab" aria-selected={exportTarget === "mongodb"} className={exportTarget === "mongodb" ? "active" : ""} onClick={() => { setExportTarget("mongodb"); setExportCopied(false); }}>MongoDB</button>
            <button type="button" role="tab" aria-selected={exportTarget === "supabase"} className={exportTarget === "supabase" ? "active" : ""} onClick={() => { setExportTarget("supabase"); setExportCopied(false); }}>Supabase</button>
          </div>
          <p className="export-note">{exportTarget === "mongodb"
            ? "Tạo collections, JSON Schema validators và indexes. Quan hệ được tham chiếu bằng ObjectId; N:M tạo join collection."
            : exportTarget === "supabase"
              ? "Tạo tables trong schema public của Supabase. Quan hệ 1:N/1:1 thêm cột <source>_id ở bảng đích; N:M tạo bảng nối. Hãy đánh dấu PK trên các bảng liên quan."
              : "Tạo tables, khóa chính và khóa ngoại cho PostgreSQL. Quan hệ 1:N/1:1 thêm cột <source>_id ở bảng đích; N:M tạo bảng nối. Hãy đánh dấu PK trên các bảng liên quan."}</p>
          <pre className="export-code"><code>{exportCode}</code></pre>
          <footer className="export-footer">
            <span>{exportTarget === "mongodb" ? "Tệp mongosh · .js" : "Tệp SQL · .sql"}</span>
            <div><button type="button" className="copy-button" onClick={copyExport}><Icon name={exportCopied ? "check" : "copy"} size={15} />{exportCopied ? "Đã sao chép" : "Sao chép"}</button><button type="button" className="share-button" onClick={downloadExport}><Icon name="download" size={15} /> Tải tệp</button></div>
          </footer>
        </section>
      </div>}

      <footer className="statusbar">
        <div className="status-left"><span className="status-indicator" /><span>{exportHint}</span><span className="status-divider" /><span>{relations.length} quan hệ</span><span className="status-divider" /><span>{decorations.length} thành phần</span><span className="status-divider" /><span>PostgreSQL</span></div>
        <div className="status-right"><span>{mode === "relation" ? `Kéo bảng để nối · ${relationType}` : "Kéo bảng hoặc ghi chú để di chuyển"}</span><span className="status-divider" /><span className="keyboard-hint">Phím tắt: <kbd>V</kbd> <kbd>T</kbd> <kbd>R</kbd> <kbd>N</kbd> <kbd>A</kbd> <kbd>G</kbd></span></div>
      </footer>
    </div>
  );
}
