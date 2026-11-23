"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

type ColumnReference = { entityId: string; columnId: string };
type Column = {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  unique?: boolean;
  nullable?: boolean;
  references?: ColumnReference;
  relationId?: string;
  uniqueGroup?: string;
};
type Entity = { id: string; name: string; x: number; y: number; columns: Column[] };
type RelationSide = "top" | "right" | "bottom" | "left";
type RelationPort = { side: RelationSide };
type Relation = { id: string; from: string; to: string; label: string; fromPort?: RelationPort; toPort?: RelationPort };
type TaskPrompt = { title: string; description: string };
type Decoration = { id: string; kind: "note" | "text" | "frame"; x: number; y: number; content: string };
type LinkPreview = { from: string; side: RelationSide; sx: number; sy: number; x: number; y: number; direction: 1 | -1 };
type ToolMode = "select" | "relation";

const WORLD_W = 1500;
const WORLD_H = 1000;
const CARD_W = 310;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;
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

function primaryColumns(entity: Entity) {
  return entity.columns.filter((column) => column.pk);
}

function foreignKeyType(type: string) {
  const normalized = type.toUpperCase();
  if (normalized === "SERIAL") return "INTEGER";
  if (normalized === "BIGSERIAL") return "BIGINT";
  return type;
}

function relationFieldName(entity: Entity, key: Column) {
  const table = singularize(entity.name || "table");
  return key.name.toLowerCase() === "id" ? `${table}_id` : `${table}_${key.name || "key"}`;
}

function uniqueColumnName(entity: Entity, baseName: string) {
  const existing = new Set(entity.columns.map((column) => column.name.toLowerCase()));
  let name = baseName;
  let suffix = 2;
  while (existing.has(name.toLowerCase())) name = `${baseName}_${suffix++}`;
  return name;
}

function makeForeignKeyColumns(
  source: Entity,
  target: Entity,
  relationId: string,
  options: { asPrimary?: boolean; uniqueGroup?: string } = {},
): Column[] | null {
  const keys = primaryColumns(source);
  if (!keys.length) return null;
  const targetWithNewColumns = { ...target, columns: [...target.columns] };
  return keys.map((key) => {
    const name = uniqueColumnName(targetWithNewColumns, relationFieldName(source, key));
    const column: Column = {
      id: makeId(),
      name,
      type: foreignKeyType(key.type),
      pk: options.asPrimary ?? false,
      fk: true,
      unique: false,
      nullable: !(options.asPrimary ?? false),
      references: { entityId: source.id, columnId: key.id },
      relationId,
      uniqueGroup: options.uniqueGroup,
    };
    targetWithNewColumns.columns.push(column);
    return column;
  });
}

function reconcileRelationForeignKeys(entities: Entity[], relations: Relation[]) {
  const next: Entity[] = entities.map((entity) => ({ ...entity, columns: entity.columns.map((column): Column => ({ ...column, nullable: column.nullable ?? !column.pk })) }));
  for (const relation of relations.filter((item) => item.label !== "N : M")) {
    const source = next.find((entity) => entity.id === relation.from);
    const target = next.find((entity) => entity.id === relation.to);
    const keys = source && primaryColumns(source);
    if (!source || !target || !keys?.length) continue;
    const targetKeys = [...target.columns];
    const usedIds = new Set<string>();
    for (const key of keys) {
      const baseName = relationFieldName(source, key).toLowerCase();
      const legacyName = `${singularize(source.name || "table")}_id`.toLowerCase();
      const existing = targetKeys.find((column) => column.relationId === relation.id && column.references?.columnId === key.id && !usedIds.has(column.id))
        ?? targetKeys.find((column) => column.references?.entityId === source.id && column.references.columnId === key.id && (!column.relationId || column.relationId === relation.id) && !usedIds.has(column.id))
        ?? targetKeys.find((column) => (column.name.toLowerCase() === baseName || column.name.toLowerCase() === legacyName) && !column.relationId && !usedIds.has(column.id));
      const generated: Column = existing
        ? { ...existing, type: foreignKeyType(key.type), fk: true, references: { entityId: source.id, columnId: key.id }, relationId: relation.id, uniqueGroup: relation.label === "1 : 1" ? relation.id : undefined }
        : {
            id: makeId(),
            name: uniqueColumnName({ ...target, columns: targetKeys }, relationFieldName(source, key)),
            type: foreignKeyType(key.type),
            fk: true,
            unique: false,
            nullable: true,
            references: { entityId: source.id, columnId: key.id },
            relationId: relation.id,
            uniqueGroup: relation.label === "1 : 1" ? relation.id : undefined,
          };
      if (relation.label === "1 : 1") generated.uniqueGroup = relation.id;
      if (existing) targetKeys[targetKeys.findIndex((column) => column.id === existing.id)] = generated;
      else targetKeys.push(generated);
      usedIds.add(generated.id);
    }
    target.columns = targetKeys;
  }
  return next;
}

function entityLinkY(entity: Entity) {
  return entity.y + entityHeight(entity) / 2;
}

function entityHeight(entity: Entity) {
  const rowsHeight = entity.columns.reduce((height, column) => height + (column.fk ? 57 : 34), 0);
  return 47 + 7 + rowsHeight + 39;
}

function nearestRelationSide(entity: Entity, x: number, y: number): RelationSide {
  const distances: Record<RelationSide, number> = {
    top: Math.abs(y - entity.y),
    right: Math.abs(x - (entity.x + CARD_W)),
    bottom: Math.abs(y - (entity.y + entityHeight(entity))),
    left: Math.abs(x - entity.x),
  };
  return (Object.keys(distances) as RelationSide[]).reduce((nearest, side) => distances[side] < distances[nearest] ? side : nearest, "top");
}

function sideNormal(side: RelationSide) {
  if (side === "top") return { x: 0, y: -1 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "bottom") return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function sideCenter(entity: Entity, side: RelationSide) {
  if (side === "top") return { x: entity.x + CARD_W / 2, y: entity.y, side };
  if (side === "right") return { x: entity.x + CARD_W, y: entityLinkY(entity), side };
  if (side === "bottom") return { x: entity.x + CARD_W / 2, y: entity.y + entityHeight(entity), side };
  return { x: entity.x, y: entityLinkY(entity), side };
}

function inferRelationSide(entity: Entity, other: Entity): RelationSide {
  const dx = other.x + CARD_W / 2 - (entity.x + CARD_W / 2);
  const dy = other.y + entityHeight(other) / 2 - (entity.y + entityHeight(entity) / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function relationPort(entity: Entity, relation: Relation, endpoint: "from" | "to", entities: Entity[], relations: Relation[]) {
  const storedPort = endpoint === "from" ? relation.fromPort : relation.toPort;
  const otherId = endpoint === "from" ? relation.to : relation.from;
  const other = entities.find((item) => item.id === otherId);
  const side = storedPort?.side ?? (other ? inferRelationSide(entity, other) : "right");
  const endpoints = relations.flatMap((item) => {
    const source = entities.find((candidate) => candidate.id === item.from);
    const target = entities.find((candidate) => candidate.id === item.to);
    if (!source || !target) return [];
    const itemSide = item.from === entity.id
      ? item.fromPort?.side ?? inferRelationSide(entity, target)
      : item.to === entity.id
        ? item.toPort?.side ?? inferRelationSide(entity, source)
        : null;
    if (itemSide !== side) return [];
    return [{ id: `${item.id}:${item.from === entity.id ? "from" : "to"}` }];
  }).sort((a, b) => a.id.localeCompare(b.id));
  const portId = `${relation.id}:${endpoint}`;
  const index = Math.max(0, endpoints.findIndex((item) => item.id === portId));
  const count = Math.max(1, endpoints.length);
  const height = entityHeight(entity);
  if (side === "top" || side === "bottom") {
    const x = entity.x + 28 + Math.max(0, CARD_W - 56) * (index + 1) / (count + 1);
    return { x, y: side === "top" ? entity.y : entity.y + height, side };
  }
  const y = entity.y + 24 + Math.max(0, height - 48) * (index + 1) / (count + 1);
  return { x: side === "left" ? entity.x : entity.x + CARD_W, y, side };
}

function relationPath(from: { x: number; y: number; side: RelationSide }, to: { x: number; y: number; side: RelationSide }) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const curve = Math.max(55, Math.min(170, distance * 0.38));
  const fromNormal = sideNormal(from.side);
  const toNormal = sideNormal(to.side);
  return `M ${from.x} ${from.y} C ${from.x + fromNormal.x * curve} ${from.y + fromNormal.y * curve}, ${to.x + toNormal.x * curve} ${to.y + toNormal.y * curve}, ${to.x} ${to.y}`;
}

function cardinalityPosition(port: { x: number; y: number; side: RelationSide }) {
  const offset = 15;
  if (port.side === "top") return { x: port.x, y: port.y - offset };
  if (port.side === "right") return { x: port.x + offset, y: port.y };
  if (port.side === "bottom") return { x: port.x, y: port.y + offset };
  return { x: port.x - offset, y: port.y };
}

function postgresScript(entities: Entity[], relations: Relation[], supabase = false) {
  const schemaPrefix = supabase ? "public." : "";
  const tableRef = (name: string) => `${schemaPrefix}${quoteIdentifier(name)}`;
  const notes: string[] = [];
  const statements: string[] = [];
  const uniqueStatements: string[] = [];
  const foreignKeys: string[] = [];

  for (const entity of entities) {
    if (!entity.columns.length) {
      notes.push(`-- ${entity.name}: table not generated because it has no columns.`);
      continue;
    }
    const definitions = entity.columns.map((column) => `  ${quoteIdentifier(column.name)} ${column.type}${column.nullable && !column.pk ? "" : " NOT NULL"}${column.unique && !column.pk && !column.uniqueGroup ? " UNIQUE" : ""}`);
    const constraints: string[] = [];
    const primaryKeys = entity.columns.filter((column) => column.pk);
    if (primaryKeys.length) constraints.push(`  PRIMARY KEY (${primaryKeys.map((column) => quoteIdentifier(column.name)).join(", ")})`);
    const uniqueGroups = new Map<string, Column[]>();
    for (const column of entity.columns) {
      if (!column.uniqueGroup) continue;
      uniqueGroups.set(column.uniqueGroup, [...(uniqueGroups.get(column.uniqueGroup) ?? []), column]);
    }
    for (const columns of uniqueGroups.values()) uniqueStatements.push(`ALTER TABLE ${tableRef(entity.name)} ADD UNIQUE (${columns.map((column) => quoteIdentifier(column.name)).join(", ")});`);

    const fkGroups = new Map<string, Column[]>();
    for (const column of entity.columns.filter((item) => item.fk)) {
      const key = `${column.relationId ?? column.id}:${column.references?.entityId ?? "unselected"}`;
      fkGroups.set(key, [...(fkGroups.get(key) ?? []), column]);
    }
    for (const columns of fkGroups.values()) {
      const first = columns[0];
      const source = first.references && entities.find((item) => item.id === first.references?.entityId);
      const referenced = source && columns.map((column) => source.columns.find((item) => item.id === column.references?.columnId));
      if (!source || !referenced?.length || referenced.some((column) => !column)) {
        notes.push(`-- ${entity.name}.${columns.map((column) => column.name).join(", ")}: select a valid referenced key for every foreign-key column.`);
        continue;
      }
      const validReferenced = referenced as Column[];
      const pkIds = new Set(source.columns.filter((column) => column.pk).map((column) => column.id));
      const referencedIds = new Set(validReferenced.map((column) => column.id));
      const samePk = validReferenced.length === pkIds.size && referencedIds.size === pkIds.size && validReferenced.every((column) => pkIds.has(column.id));
      const referencedGroup = validReferenced[0].uniqueGroup;
      const groupSize = referencedGroup ? source.columns.filter((column) => column.uniqueGroup === referencedGroup).length : 0;
      const sameUniqueGroup = validReferenced.length > 1 && Boolean(referencedGroup) && validReferenced.length === groupSize && referencedIds.size === groupSize
        && validReferenced.every((column) => column.uniqueGroup === referencedGroup);
      const individuallyUnique = validReferenced.length === 1 && (validReferenced[0].pk || validReferenced[0].unique || (Boolean(referencedGroup) && groupSize === 1));
      if (!samePk && !sameUniqueGroup && !individuallyUnique) {
        notes.push(`-- ${entity.name}.${columns.map((column) => column.name).join(", ")}: referenced columns on ${source.name} must be a primary or unique key.`);
        continue;
      }
      foreignKeys.push(`ALTER TABLE ${tableRef(entity.name)} ADD FOREIGN KEY (${columns.map((column) => quoteIdentifier(column.name)).join(", ")}) REFERENCES ${tableRef(source.name)} (${validReferenced.map((column) => quoteIdentifier(column.name)).join(", ")});`);
    }

    statements.push(`CREATE TABLE IF NOT EXISTS ${tableRef(entity.name)} (\n${[...definitions, ...constraints].join(",\n")}\n);`);
  }

  const seenJoinTables = new Set<string>();
  for (const relation of relations.filter((item) => item.label === "N : M")) {
    const from = entities.find((entity) => entity.id === relation.from);
    const to = entities.find((entity) => entity.id === relation.to);
    const fromKeys = from && primaryColumns(from);
    const toKeys = to && primaryColumns(to);
    if (!from || !to || !fromKeys?.length || !toKeys?.length) {
      notes.push(`-- N:M relation ${from?.name ?? relation.from} <-> ${to?.name ?? relation.to}: choose a PK on both tables before creating a join table.`);
      continue;
    }
    const joinName = uniqueJoinName(entities, `${from.name}_${to.name}`);
    if (seenJoinTables.has(joinName)) continue;
    seenJoinTables.add(joinName);
    const fromFields = fromKeys.map((key) => relationFieldName(from, key));
    const toFields = toKeys.map((key) => relationFieldName(to, key));
    const joinColumns = [...fromKeys.map((key, index) => `  ${quoteIdentifier(fromFields[index])} ${foreignKeyType(key.type)} NOT NULL`), ...toKeys.map((key, index) => `  ${quoteIdentifier(toFields[index])} ${foreignKeyType(key.type)} NOT NULL`)];
    statements.push(`CREATE TABLE IF NOT EXISTS ${tableRef(joinName)} (\n${joinColumns.join(",\n")},\n  PRIMARY KEY (${[...fromFields, ...toFields].map(quoteIdentifier).join(", ")}),\n  FOREIGN KEY (${fromFields.map(quoteIdentifier).join(", ")}) REFERENCES ${tableRef(from.name)} (${fromKeys.map((key) => quoteIdentifier(key.name)).join(", ")}),\n  FOREIGN KEY (${toFields.map(quoteIdentifier).join(", ")}) REFERENCES ${tableRef(to.name)} (${toKeys.map((key) => quoteIdentifier(key.name)).join(", ")})\n);`);
  }

  const header = supabase
    ? "-- Supabase SQL (run in the SQL Editor; tables are created in the public schema)."
    : "-- PostgreSQL DDL generated from the ERD diagram.";
  return [header, ...notes, ...statements, ...uniqueStatements, ...foreignKeys].join("\n\n");
}

function uniqueJoinName(entities: Entity[], baseName: string) {
  const used = new Set(entities.map((entity) => entity.name.toLowerCase()));
  let name = baseName;
  let suffix = 2;
  while (used.has(name.toLowerCase())) name = `${baseName}_${suffix++}`;
  return name;
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
      if (!column.nullable || column.pk) required.push(column.name || "column_name");
    }
    const collection = `erdDb.getCollection(${JSON.stringify(entity.name)})`;
    const primaryKeys = entity.columns.filter((column) => column.pk);
    if (primaryKeys.length) indexes.push(`${collection}.createIndex({ ${primaryKeys.map((column) => `${JSON.stringify(column.name)}: 1`).join(", ")} }, { unique: true });`);
    for (const column of entity.columns.filter((item) => item.unique && !item.pk && !item.uniqueGroup)) indexes.push(`${collection}.createIndex({ ${JSON.stringify(column.name)}: 1 }, { unique: true });`);
    const uniqueGroups = new Map<string, Column[]>();
    const foreignKeyGroups = new Map<string, Column[]>();
    for (const column of entity.columns) {
      if (column.uniqueGroup) uniqueGroups.set(column.uniqueGroup, [...(uniqueGroups.get(column.uniqueGroup) ?? []), column]);
      if (column.fk) {
        const key = `${column.relationId ?? column.id}:${column.references?.entityId ?? "unselected"}`;
        foreignKeyGroups.set(key, [...(foreignKeyGroups.get(key) ?? []), column]);
      }
    }
    for (const columns of uniqueGroups.values()) indexes.push(`${collection}.createIndex({ ${columns.map((column) => `${JSON.stringify(column.name)}: 1`).join(", ")} }, { unique: true });`);
    for (const columns of foreignKeyGroups.values()) indexes.push(`${collection}.createIndex({ ${columns.map((column) => `${JSON.stringify(column.name)}: 1`).join(", ")} });`);

    const schema = { bsonType: "object", properties, ...(required.length ? { required } : {}) };
    blocks.push(`erdDb.createCollection(${JSON.stringify(entity.name)}, {\n  validator: {\n    $jsonSchema: ${JSON.stringify(schema, null, 2).replaceAll("\n", "\n    ")}\n  }\n});`);
  }

  const seenJoinTables = new Set<string>();
  for (const relation of relations.filter((item) => item.label === "N : M")) {
    const from = entities.find((entity) => entity.id === relation.from);
    const to = entities.find((entity) => entity.id === relation.to);
    if (!from || !to) continue;
    const joinName = uniqueJoinName(entities, `${from.name}_${to.name}`);
    if (seenJoinTables.has(joinName)) continue;
    seenJoinTables.add(joinName);
    const fromKeys = primaryColumns(from);
    const toKeys = primaryColumns(to);
    if (!fromKeys.length || !toKeys.length) continue;
    const fromFields = fromKeys.map((key) => relationFieldName(from, key));
    const toFields = toKeys.map((key) => relationFieldName(to, key));
    const properties = Object.fromEntries([...fromKeys.map((key, index) => [fromFields[index], { bsonType: bsonType(key.type) }]), ...toKeys.map((key, index) => [toFields[index], { bsonType: bsonType(key.type) }])]);
    blocks.push(`erdDb.createCollection(${JSON.stringify(joinName)}, {\n  validator: { $jsonSchema: ${JSON.stringify({ bsonType: "object", properties, required: [...fromFields, ...toFields] })} }\n});`);
    indexes.push(`erdDb.getCollection(${JSON.stringify(joinName)}).createIndex({ ${[...fromFields, ...toFields].map((field) => `${JSON.stringify(field)}: 1`).join(", ")} }, { unique: true });`);
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
  const [relationMessage, setRelationMessage] = useState("");
  const [zoom, setZoom] = useState(0.9);
  const [projectName, setProjectName] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskPrompt, setTaskPrompt] = useState<TaskPrompt | null>(null);
  const [taskPromptExpanded, setTaskPromptExpanded] = useState(true);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");
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
  const relationDragRef = useRef<{ from: string; fromPort: RelationPort; pointerId: number } | null>(null);
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number; worldX: number; worldY: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loadDiagram = async () => {
      try {
        const response = await fetch(`/api/diagrams/${diagramId}`, { cache: "no-store" });
        if (response.status === 401) { router.replace("/login"); return; }
        if (response.status === 404) { router.replace("/"); return; }
        const result = await readJsonResponse<{ error?: string; name?: string; taskId?: string | null; taskPrompt?: TaskPrompt | null; entities?: Entity[]; relations?: Relation[]; decorations?: Decoration[] }>(response);
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
        setTaskId(result.taskId ?? null);
        setTaskPrompt(result.taskPrompt ?? null);
        setEntities(reconcileRelationForeignKeys(payload.entities, payload.relations));
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
        { id: idColumnId, name: "id", type: "UUID", pk: true, nullable: false },
        { id: createdAtId, name: "created_at", type: "TIMESTAMP", nullable: true },
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
    const currentEntity = entities.find((entity) => entity.id === entityId);
    const currentColumn = currentEntity?.columns.find((column) => column.id === columnId);
    if (!currentColumn) return;
    if (patch.pk === false && currentColumn.pk && entities.some((entity) => entity.columns.some((column) => column.fk && column.references?.entityId === entityId && column.references.columnId === columnId))) {
      setRelationMessage("Cột này đang được tham chiếu bởi khóa ngoại. Hãy xóa khóa ngoại liên quan trước.");
      return;
    }
    if (patch.unique === false && entities.some((entity) => entity.columns.some((column) => column.fk && column.references?.entityId === entityId && column.references.columnId === columnId))) {
      setRelationMessage("Cột UNIQUE này đang được tham chiếu bởi khóa ngoại. Hãy xóa khóa ngoại liên quan trước.");
      return;
    }
    if (patch.nullable === true && currentColumn.pk) {
      setRelationMessage("Khóa chính luôn phải NOT NULL.");
      return;
    }
    const normalizedPatch = patch.pk === true ? { ...patch, nullable: false } : patch;
    setEntities((current) => {
      const next = current.map((entity) => entity.id === entityId
        ? { ...entity, columns: entity.columns.map((column) => column.id === columnId ? { ...column, ...normalizedPatch } : column) }
        : patch.type && entity.id !== entityId
          ? { ...entity, columns: entity.columns.map((column) => column.fk && column.references?.entityId === entityId && column.references.columnId === columnId ? { ...column, type: foreignKeyType(patch.type!) } : column) }
          : entity);
      return patch.pk === true ? reconcileRelationForeignKeys(next, relations) : next;
    });
  };

  const createRelation = (fromId: string, toId: string, label: string, ports?: { fromPort: RelationPort; toPort: RelationPort }) => {
    if (relations.some((relation) => relation.from === fromId && relation.to === toId)) {
      setRelationMessage("Đã có đường nối cùng chiều giữa hai bảng này.");
      return;
    }
    const source = entities.find((entity) => entity.id === fromId);
    const target = entities.find((entity) => entity.id === toId);
    if (!source || !target) return;
    const relation: Relation = { id: makeId(), from: fromId, to: toId, label, ...ports };
    if (label === "N : M") {
      setRelations((current) => [...current, relation]);
      return;
    }
    if (!primaryColumns(source).length) {
      setRelationMessage(`Hãy đánh dấu khóa chính cho bảng “${source.name}” trước khi nối.`);
      return;
    }
    setEntities(reconcileRelationForeignKeys(entities, [...relations, relation]));
    setRelations((current) => [...current, relation]);
  };

  const createJunctionTable = (connection: { from: string; to: string; fromPort: RelationPort; toPort: RelationPort }) => {
    const source = entities.find((entity) => entity.id === connection.from);
    const target = entities.find((entity) => entity.id === connection.to);
    if (!source || !target) return;
    const bridgeId = makeId();
    const bridgeName = uniqueJoinName(entities, `${singularize(source.name)}_${singularize(target.name)}`);
    const firstRelation: Relation = { id: makeId(), from: source.id, to: bridgeId, label: "1 : N", fromPort: connection.fromPort };
    const secondRelation: Relation = { id: makeId(), from: target.id, to: bridgeId, label: "1 : N", fromPort: connection.toPort };
    const emptyBridge: Entity = { id: bridgeId, name: bridgeName, x: 0, y: 0, columns: [] };
    const firstKeys = makeForeignKeyColumns(source, emptyBridge, firstRelation.id, { asPrimary: true });
    const secondKeys = makeForeignKeyColumns(target, { ...emptyBridge, columns: firstKeys ?? [] }, secondRelation.id, { asPrimary: true });
    if (!firstKeys || !secondKeys) {
      setRelationMessage("Hai bảng cần có khóa chính trước khi tạo bảng trung gian.");
      return;
    }
    const bridgeColumns = [...firstKeys, ...secondKeys];
    const bridgeHeight = entityHeight({ ...emptyBridge, columns: bridgeColumns });
    let placedSource = source;
    let placedTarget = target;
    const horizontalPorts = [connection.fromPort.side, connection.toPort.side].every((side) => side === "left" || side === "right");
    const verticalPorts = [connection.fromPort.side, connection.toPort.side].every((side) => side === "top" || side === "bottom");
    if (horizontalPorts) {
      const distance = Math.abs(sideCenter(placedTarget, connection.toPort.side).x - sideCenter(placedSource, connection.fromPort.side).x);
      const extraSpace = CARD_W + 36 - distance;
      if (extraSpace > 0) {
        const direction = Math.sign((target.x + CARD_W / 2) - (source.x + CARD_W / 2)) || (connection.fromPort.side === "right" ? 1 : -1);
        const shift = extraSpace / 2;
        const clampX = (x: number) => Math.max(0, Math.min(WORLD_W - CARD_W, x));
        let sourceX = clampX(source.x - direction * shift);
        let targetX = clampX(target.x + direction * shift);
        let remaining = Math.max(0, extraSpace - direction * (source.x - sourceX + targetX - target.x));
        const targetExtraX = clampX(targetX + direction * remaining);
        remaining = Math.max(0, remaining - direction * (targetExtraX - targetX));
        targetX = targetExtraX;
        sourceX = clampX(sourceX - direction * remaining);
        placedSource = { ...source, x: sourceX };
        placedTarget = { ...target, x: targetX };
      }
    } else if (verticalPorts) {
      const distance = Math.abs(sideCenter(placedTarget, connection.toPort.side).y - sideCenter(placedSource, connection.fromPort.side).y);
      const extraSpace = bridgeHeight + 36 - distance;
      if (extraSpace > 0) {
        const direction = Math.sign((target.y + entityHeight(target) / 2) - (source.y + entityHeight(source) / 2)) || (connection.fromPort.side === "bottom" ? 1 : -1);
        const shift = extraSpace / 2;
        const clampY = (y: number, entity: Entity) => Math.max(0, Math.min(WORLD_H - entityHeight(entity), y));
        let sourceY = clampY(source.y - direction * shift, source);
        let targetY = clampY(target.y + direction * shift, target);
        let remaining = Math.max(0, extraSpace - direction * (source.y - sourceY + targetY - target.y));
        const targetExtraY = clampY(targetY + direction * remaining, target);
        remaining = Math.max(0, remaining - direction * (targetExtraY - targetY));
        targetY = targetExtraY;
        sourceY = clampY(sourceY - direction * remaining, source);
        placedSource = { ...source, y: sourceY };
        placedTarget = { ...target, y: targetY };
      }
    }
    const sourcePort = sideCenter(placedSource, connection.fromPort.side);
    const targetPort = sideCenter(placedTarget, connection.toPort.side);
    const centerX = (sourcePort.x + targetPort.x) / 2;
    const centerY = (sourcePort.y + targetPort.y) / 2;
    const bridge: Entity = {
      ...emptyBridge,
      x: Math.max(20, Math.min(WORLD_W - CARD_W - 20, centerX - CARD_W / 2)),
      y: Math.max(20, Math.min(WORLD_H - bridgeHeight - 20, centerY - bridgeHeight / 2)),
      columns: bridgeColumns,
    };
    setEntities((current) => [...current.map((entity) => entity.id === placedSource.id ? placedSource : entity.id === placedTarget.id ? placedTarget : entity), bridge]);
    setRelations((current) => [...current, firstRelation, secondRelation]);
    setMode("select");
  };

  const deleteEntity = (id: string) => {
    const referencing = entities.flatMap((entity) => entity.columns.filter((column) => column.fk && column.references?.entityId === id).map((column) => `${entity.name}.${column.name}`));
    if (referencing.length) setRelationMessage(`Đã xóa bảng có liên quan; các khóa ngoại sau cần kiểm tra: ${referencing.join(", ")}.`);
    setEntities((current) => current.filter((entity) => entity.id !== id).map((entity) => ({
      ...entity,
      columns: entity.columns.filter((column) => !(column.fk && column.references?.entityId === id)),
    })));
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

  const submitTask = async () => {
    if (!taskId || saved !== "saved" || submittingTask) return;
    setSubmittingTask(true);
    setTaskMessage("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const result = await readJsonResponse<{ error?: string; version?: number }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể nộp bài.");
      setTaskMessage(`Đã nộp bài phiên bản ${result.version ?? "mới"}. Bạn vẫn có thể sửa và nộp lại.`);
    } catch (submitError) {
      setTaskMessage(submitError instanceof Error ? submitError.message : "Không thể nộp bài.");
    } finally {
      setSubmittingTask(false);
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

  const zoomToAt = (nextZoom: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    if (!viewport) { setZoom(next); return; }
    const bounds = viewport.getBoundingClientRect();
    const localX = (clientX ?? bounds.left + bounds.width / 2) - bounds.left;
    const localY = (clientY ?? bounds.top + bounds.height / 2) - bounds.top;
    const worldX = (viewport.scrollLeft + localX) / zoom;
    const worldY = (viewport.scrollTop + localY) / zoom;
    setZoom(next);
    window.requestAnimationFrame(() => {
      if (!viewport.isConnected) return;
      viewport.scrollLeft = Math.max(0, worldX * next - localX);
      viewport.scrollTop = Math.max(0, worldY * next - localY);
    });
  };

  const onViewportPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    const pointers = touchPointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [first, second] = [...pointers.values()].slice(0, 2);
      const bounds = event.currentTarget.getBoundingClientRect();
      const localX = (first.x + second.x) / 2 - bounds.left;
      const localY = (first.y + second.y) / 2 - bounds.top;
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        zoom,
        worldX: (event.currentTarget.scrollLeft + localX) / zoom,
        worldY: (event.currentTarget.scrollTop + localY) / zoom,
      };
      panRef.current = null;
      dragRef.current = null;
      relationDragRef.current = null;
      setLinkPreview(null);
      event.preventDefault();
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest(".entity-card, .canvas-decoration, button, input, select, textarea")) return;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    zoomToAt(zoom * factor, event.clientX, event.clientY);
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
      const anchor = sideCenter(source, relationDrag.fromPort.side);
      setLinkPreview({ from: source.id, side: relationDrag.fromPort.side, sx: anchor.x, sy: anchor.y, x, y, direction });
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
          const target = entities.find((entity) => entity.id === to);
          const viewport = viewportRef.current;
          let toPort: RelationPort | null = null;
          if (target && viewport) {
            const bounds = viewport.getBoundingClientRect();
            const x = (event.clientX - bounds.left + viewport.scrollLeft) / zoom;
            const y = (event.clientY - bounds.top + viewport.scrollTop) / zoom;
            toPort = { side: nearestRelationSide(target, x, y) };
          }
          if (relations.some((relation) => relation.from === relationDrag.from && relation.to === to)) {
            setRelationMessage("Đã có đường nối cùng chiều giữa hai bảng này.");
          } else if (relationType === "N : M") {
            const from = entities.find((entity) => entity.id === relationDrag.from);
            if (from && target && (!primaryColumns(from).length || !primaryColumns(target).length)) {
              setRelationMessage("Hãy đánh dấu khóa chính cho cả hai bảng trước khi nối N:M.");
              setMode("select");
            } else if (target && toPort) {
              createJunctionTable({ from: relationDrag.from, to, fromPort: relationDrag.fromPort, toPort });
            }
          } else if (target && toPort) {
            createRelation(relationDrag.from, to, relationType, { fromPort: relationDrag.fromPort, toPort });
          }
        }
      }
      relationDragRef.current = null;
      setLinkPreview(null);
    }
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const onViewportPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && touchPointersRef.current.has(event.pointerId)) {
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = pinchRef.current;
      if (pinch && touchPointersRef.current.size >= 2) {
        const [first, second] = [...touchPointersRef.current.values()].slice(0, 2);
        const bounds = event.currentTarget.getBoundingClientRect();
        const localX = (first.x + second.x) / 2 - bounds.left;
        const localY = (first.y + second.y) / 2 - bounds.top;
        const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
        const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinch.zoom * distance / pinch.distance));
        setZoom(nextZoom);
        window.requestAnimationFrame(() => {
          const viewport = viewportRef.current;
          if (!viewport?.isConnected) return;
          viewport.scrollLeft = Math.max(0, pinch.worldX * nextZoom - localX);
          viewport.scrollTop = Math.max(0, pinch.worldY * nextZoom - localY);
        });
      } else if (panRef.current?.pointerId === event.pointerId) {
        const pan = panRef.current;
        event.currentTarget.scrollLeft = pan.scrollLeft + pan.x - event.clientX;
        event.currentTarget.scrollTop = pan.scrollTop + pan.y - event.clientY;
      }
    }
    onCanvasPointerMove(event);
  };

  const onViewportPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    finishDrag(event);
    touchPointersRef.current.delete(event.pointerId);
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
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
          {taskId && <><Link className="task-editor-link" href={`/tasks/${taskId}`}>Bài tập</Link><button className="submit-task-button" type="button" onClick={() => void submitTask()} disabled={saved !== "saved" || submittingTask} title={saved !== "saved" ? "Đợi sơ đồ lưu xong rồi nộp" : "Nộp bản vẽ hiện tại"}>{submittingTask ? "Đang nộp…" : "Nộp bài"}</button></>}
          <button className="logout-button" type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
          <button className="share-button" type="button" onClick={() => { setExportOpen(true); setExportCopied(false); }} disabled={entities.length === 0} title={entities.length === 0 ? "Thêm bảng trước khi xuất mã" : "Xem và xuất mã tạo cơ sở dữ liệu"}><Icon name="download" size={16} /> Xuất mã</button>
        </div>
      </header>
      {taskMessage && <div className={`task-submit-message ${taskMessage.startsWith("Đã nộp") ? "success" : "error"}`} role="status">{taskMessage}<button type="button" aria-label="Đóng thông báo" onClick={() => setTaskMessage("")}>×</button></div>}
      {relationMessage && <div className="erd-message" role="status">{relationMessage}<button type="button" aria-label="Đóng thông báo" onClick={() => setRelationMessage("")}>×</button></div>}

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
          <select
            className="relation-type"
            aria-label="Kiểu quan hệ mới"
            title="Chọn kiểu quan hệ: 1:1 (Xanh lá), 1:N (Tím), N:M (Hồng)"
            value={relationType}
            onChange={(event) => setRelationType(event.target.value)}
            style={{
              width: "auto",
              padding: "0 8px",
              borderColor: relationType === "1 : 1" ? "#86efac" : relationType === "1 : N" ? "#c4b5fd" : "#f472b6",
              color: relationType === "1 : 1" ? "#15803d" : relationType === "1 : N" ? "#6d28d9" : "#be185d",
              backgroundColor: relationType === "1 : 1" ? "#f0fdf4" : relationType === "1 : N" ? "#faf5ff" : "#fdf2f8",
              fontWeight: 700,
            }}
          >
            <option value="1 : 1">1 : 1 (Xanh lá)</option>
            <option value="1 : N">1 : N (Tím)</option>
            <option value="N : M">N : M (Hồng)</option>
          </select>
          <span className="tool-divider" />
          <button className="tool-button" onClick={() => addDecoration("note")} title="Thêm ghi chú" type="button"><Icon name="note" size={17} /><span>Ghi chú</span><kbd>N</kbd></button>
          <button className="tool-button" onClick={() => addDecoration("text")} title="Thêm văn bản" type="button"><Icon name="text" size={17} /><span>Văn bản</span><kbd>A</kbd></button>
          <button className="tool-button" onClick={() => addDecoration("frame")} title="Thêm khung nhóm" type="button"><Icon name="frame" size={17} /><span>Nhóm</span><kbd>G</kbd></button>
          <span className="tool-divider" />
          <button className="tool-button arrange-button" onClick={arrangeEntities} title="Sắp xếp bảng" type="button"><Icon name="arrange" size={17} /><span>Sắp xếp</span></button>
          <div className="zoom-control">
            <button type="button" className="icon-button" aria-label="Thu nhỏ" onClick={() => zoomToAt(zoom - 0.1)}><Icon name="minus" size={16} /></button>
            <button type="button" className="zoom-value" onClick={() => zoomToAt(0.9)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className="icon-button" aria-label="Phóng to" onClick={() => zoomToAt(zoom + 0.1)}><Icon name="plus" size={16} /></button>
          </div>
        </div>
      </section>

      {taskPrompt && <aside className={`task-prompt-panel ${taskPromptExpanded ? "expanded" : "collapsed"}`} aria-label="Đề bài tập">
        <header><div><span>ĐỀ BÀI</span><strong>{taskPrompt.title}</strong></div><button type="button" aria-expanded={taskPromptExpanded} onClick={() => setTaskPromptExpanded((expanded) => !expanded)}>{taskPromptExpanded ? "Thu gọn" : "Mở đề"}</button></header>
        {taskPromptExpanded && <p>{taskPrompt.description}</p>}
      </aside>}

      <main className={`canvas-viewport ${mode === "relation" ? "link-mode" : ""}`} aria-label="Bản vẽ ERD. Kéo nền để di chuyển, dùng hai ngón tay để thu phóng." ref={viewportRef} onPointerDown={onViewportPointerDown} onPointerMove={onViewportPointerMove} onPointerUp={onViewportPointerUp} onPointerCancel={onViewportPointerUp} onWheel={onCanvasWheel}>
        <div className="canvas-stage" style={{ width: WORLD_W * zoom, height: WORLD_H * zoom }}>
          <div className={`canvas-world ${gridVisible ? "grid-on" : ""}`} style={{ width: WORLD_W, height: WORLD_H, transform: `scale(${zoom})` }}>
            <svg className="relations-layer" width={WORLD_W} height={WORLD_H} aria-label="Các quan hệ giữa bảng">
              <defs>
                <marker id="arrow-green"  markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3 z" fill="#16a34a" /></marker>
                <marker id="arrow-violet" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3 z" fill="#7c3aed" /></marker>
                <marker id="arrow-pink"   markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3 z" fill="#db2777" /></marker>
              </defs>
              {relations.map((relation) => {
                const from = entities.find((entity) => entity.id === relation.from);
                const to = entities.find((entity) => entity.id === relation.to);
                if (!from || !to) return null;
                const fromPort = relationPort(from, relation, "from", entities, relations);
                const toPort = relationPort(to, relation, "to", entities, relations);
                const fromBadge = cardinalityPosition(fromPort);
                const toBadge = cardinalityPosition(toPort);
                const [fromCardinality = "1", toCardinality = "N"] = relation.label.split(":").map((part) => part.trim());
                const path = relation.label === "1 : 1"
                  ? `M ${fromPort.x} ${fromPort.y} L ${toPort.x} ${toPort.y}`
                  : relationPath(fromPort, toPort);
                // Colour per relation type
                const lineColor   = relation.label === "1 : 1" ? "#16a34a" : relation.label === "1 : N" ? "#7c3aed" : "#db2777";
                const arrowId     = relation.label === "1 : 1" ? "arrow-green" : relation.label === "1 : N" ? "arrow-violet" : "arrow-pink";
                const labelBg     = relation.label === "1 : 1" ? "#dcfce7" : relation.label === "1 : N" ? "#ede9fe" : "#fce7f3";
                const labelBorder = relation.label === "1 : 1" ? "#86efac" : relation.label === "1 : N" ? "#c4b5fd" : "#fbcfe8";
                const labelText   = relation.label === "1 : 1" ? "#15803d" : relation.label === "1 : N" ? "#6d28d9" : "#be185d";
                return <g key={relation.id}>
                  <path className="relation-halo" d={path} />
                  <path
                    d={path}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    markerStart={relation.label === "N : M" ? `url(#${arrowId})` : undefined}
                    markerEnd={relation.label !== "1 : 1" ? `url(#${arrowId})` : undefined}
                  />
                  <g transform={`translate(${fromBadge.x}, ${fromBadge.y})`}>
                    <rect x="-11" y="-9" width="22" height="18" rx="6" fill={labelBg} stroke={labelBorder} strokeWidth="1" />
                    <text textAnchor="middle" dominantBaseline="central" fill={labelText} style={{font: "700 9px 'DM Sans',sans-serif"}}>{fromCardinality}</text>
                  </g>
                  <g transform={`translate(${toBadge.x}, ${toBadge.y})`}>
                    <rect x="-11" y="-9" width="22" height="18" rx="6" fill={labelBg} stroke={labelBorder} strokeWidth="1" />
                    <text textAnchor="middle" dominantBaseline="central" fill={labelText} style={{font: "700 9px 'DM Sans',sans-serif"}}>{toCardinality}</text>
                  </g>
                </g>;
              })}
              {linkPreview && (
                <path
                  className="relation-preview"
                  stroke={relationType === "1 : 1" ? "#16a34a" : relationType === "1 : N" ? "#7c3aed" : "#db2777"}
                  d={(() => {
                    const normal = sideNormal(linkPreview.side);
                    const curve = Math.max(55, Math.min(150, Math.hypot(linkPreview.x - linkPreview.sx, linkPreview.y - linkPreview.sy) * 0.35));
                    return `M ${linkPreview.sx} ${linkPreview.sy} C ${linkPreview.sx + normal.x * curve} ${linkPreview.sy + normal.y * curve}, ${linkPreview.x - linkPreview.direction * curve} ${linkPreview.y}, ${linkPreview.x} ${linkPreview.y}`;
                  })()}
                />
              )}
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
            {entities.map((entity) => {
              const hasPk = entity.columns.some((c) => c.pk);
              const hasFk = entity.columns.some((c) => c.fk) || relations.some((r) => r.to === entity.id && r.label !== "N : M");
              let tableRoleClass = "";
              let tableRoleTag = null;
              if (hasPk && hasFk) {
                tableRoleClass = "table-is-both";
                tableRoleTag = (
                  <div style={{ display: "flex", gap: 3, marginLeft: "auto", marginRight: 4 }}>
                    <span className="table-role-tag pk-tag" title="Chứa khóa chính">PK</span>
                    <span className="table-role-tag fk-tag" title="Chứa khóa ngoại">FK</span>
                  </div>
                );
              } else if (hasPk) {
                tableRoleClass = "table-is-pk";
                tableRoleTag = <span className="table-role-tag pk-tag" style={{ marginLeft: "auto", marginRight: 4 }} title="Bảng chứa khóa chính (Vàng)">Khóa chính</span>;
              } else if (hasFk) {
                tableRoleClass = "table-is-fk";
                tableRoleTag = <span className="table-role-tag fk-tag" style={{ marginLeft: "auto", marginRight: 4 }} title="Bảng chứa khóa ngoại (Đồng)">Khóa ngoại</span>;
              }

              return (
              <article key={entity.id} data-entity-id={entity.id} className={`entity-card ${tableRoleClass} ${linkPreview?.from === entity.id ? "relation-origin" : ""}`} style={{ left: entity.x, top: entity.y }} onPointerDownCapture={(event) => {
                if (mode === "relation" && !(event.target as HTMLElement).closest("button")) {
                  const viewport = viewportRef.current;
                  if (viewport) {
                    const bounds = viewport.getBoundingClientRect();
                    const x = (event.clientX - bounds.left + viewport.scrollLeft) / zoom;
                    const y = (event.clientY - bounds.top + viewport.scrollTop) / zoom;
                    const direction = x >= entity.x + CARD_W / 2 ? 1 : -1;
                    const fromPort = { side: nearestRelationSide(entity, x, y) } as RelationPort;
                    const anchor = sideCenter(entity, fromPort.side);
                    relationDragRef.current = { from: entity.id, pointerId: event.pointerId, fromPort };
                    setLinkPreview({ from: entity.id, side: fromPort.side, sx: anchor.x, sy: anchor.y, x, y, direction });
                  }
                  event.currentTarget.setPointerCapture(event.pointerId);
                  event.preventDefault();
                }
              }} onPointerDown={(event) => {
                if (mode === "relation" || (event.target as HTMLElement).closest("button,input,select")) return;
                dragRef.current = { id: entity.id, target: "entity", pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: entity.x, originY: entity.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}>
                <div className="entity-heading">
                  <div className="entity-table-icon"><Icon name="table" size={15} /></div>
                  <input className="entity-name" value={entity.name} onChange={(event) => updateEntity(entity.id, { name: event.target.value })} aria-label={`Tên bảng ${entity.name}`} onPointerDown={(event) => event.stopPropagation()} />
                  {tableRoleTag}
                  <span className="entity-menu-dot">•••</span>
                  <button type="button" className="entity-delete" title="Xóa bảng" aria-label={`Xóa bảng ${entity.name}`} onClick={() => deleteEntity(entity.id)}><Icon name="trash" size={15} /></button>
                </div>
                <div className="column-list">
                  {entity.columns.map((column) => {
                    const isFk = Boolean(column.fk);
                    const constraintValue = column.pk && column.fk ? "PK_FK" : column.pk ? "PK" : column.fk && (column.unique || column.uniqueGroup) ? "FK_UQ" : column.fk ? "FK" : column.unique || column.uniqueGroup ? "UQ" : "NONE";
                    const referenceValue = column.references ? `${column.references.entityId}|${column.references.columnId}` : "";
                    const referenceOptions = entities.flatMap((source) => source.columns.filter((key) => key.unique || (key.pk && primaryColumns(source).length === 1) || (key.uniqueGroup && source.columns.filter((item) => item.uniqueGroup === key.uniqueGroup).length === 1)).map((key) => ({ source, key })));
                    const removeColumn = () => {
                      if (entities.some((other) => other.columns.some((key) => key.fk && key.references?.entityId === entity.id && key.references.columnId === column.id))) {
                        setRelationMessage("Không thể xóa khóa đang được bảng khác tham chiếu. Hãy xóa khóa ngoại đó trước.");
                        return;
                      }
                      if (column.relationId) {
                        setEntities((current) => current.map((item) => ({ ...item, columns: item.id === entity.id ? item.columns.filter((key) => key.relationId !== column.relationId) : item.columns })));
                        setRelations((current) => current.filter((relation) => relation.id !== column.relationId));
                      } else {
                        updateEntity(entity.id, { columns: entity.columns.filter((item) => item.id !== column.id) });
                      }
                    };
                    const updateConstraint = (value: string) => {
                      const pk = value === "PK" || value === "PK_FK";
                      const fk = value === "FK" || value === "PK_FK" || value === "FK_UQ";
                      const unique = value === "UQ" || value === "FK_UQ";
                      updateColumn(entity.id, column.id, {
                        pk,
                        fk,
                        unique,
                        nullable: pk ? false : column.nullable,
                        references: fk ? column.references : undefined,
                      });
                    };
                    const rowBg = column.pk ? "#fefce8" : isFk ? "#fff7ed" : undefined;
                    const rowBorder = column.pk ? "#fde68a" : isFk ? "#fed7aa" : undefined;
                    return (
                    <div className={`column-row ${isFk ? "has-reference" : ""}`} key={column.id} style={rowBg ? { background: rowBg, borderBottomColor: rowBorder, borderRadius: 4, paddingLeft: 4, paddingRight: 4 } : undefined}>
                      <input className="column-name" value={column.name} aria-label="Tên cột" onChange={(event) => updateColumn(entity.id, column.id, { name: event.target.value })} onPointerDown={(event) => event.stopPropagation()} />
                      <select className="column-type" aria-label={`Kiểu dữ liệu ${column.name}`} title={column.fk && column.references ? `Tự đồng bộ với ${entities.find((item) => item.id === column.references?.entityId)?.name ?? "bảng tham chiếu"}` : column.type} value={column.type} disabled={Boolean(column.fk && column.references)} onChange={(event) => updateColumn(entity.id, column.id, { type: event.target.value })} onPointerDown={(event) => event.stopPropagation()}>
                        {!typeOptions.includes(column.type) && <option value={column.type}>{column.type}</option>}
                        {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <select className={`column-constraint ${constraintValue !== "NONE" ? "has-constraint" : ""}`} aria-label={`Ràng buộc ${column.name}`} title={column.relationId ? "Khóa được quản lý theo đường nối; xóa cột để bỏ quan hệ" : "Chọn ràng buộc cho cột"} value={constraintValue} disabled={Boolean(column.relationId)} onChange={(event) => updateConstraint(event.target.value)} onPointerDown={(event) => event.stopPropagation()}>
                        <option value="NONE">—</option>
                        <option value="PK">PK</option>
                        <option value="FK">FK</option>
                        <option value="UQ">UNIQUE</option>
                        <option value="PK_FK">PK + FK</option>
                        <option value="FK_UQ">FK + UQ</option>
                      </select>
                      <select className="column-nullability" aria-label={`Cho phép NULL ${column.name}`} title={column.pk ? "Khóa chính luôn NOT NULL" : column.nullable ? "Cho phép NULL" : "NOT NULL"} value={column.nullable ? "NULL" : "NOT_NULL"} disabled={Boolean(column.pk)} onChange={(event) => updateColumn(entity.id, column.id, { nullable: event.target.value === "NULL" })} onPointerDown={(event) => event.stopPropagation()}>
                        <option value="NULL">NULL</option>
                        <option value="NOT_NULL">NN</option>
                      </select>
                      <button type="button" className="column-remove" aria-label={`Xóa cột ${column.name}`} title="Xóa cột hoặc quan hệ" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeColumn(); }}><Icon name="close" size={12} /></button>
                      {isFk && <select className="column-reference" aria-label={`Tham chiếu của ${column.name}`} value={referenceValue} onChange={(event) => {
                        const [sourceEntityId, sourceColumnId] = event.target.value.split("|");
                        const source = entities.find((item) => item.id === sourceEntityId);
                        const key = source?.columns.find((item) => item.id === sourceColumnId);
                        updateColumn(entity.id, column.id, key ? { fk: true, references: { entityId: sourceEntityId, columnId: sourceColumnId }, type: foreignKeyType(key.type) } : { fk: true, references: undefined });
                      }} onPointerDown={(event) => event.stopPropagation()}>
                        <option value="">Chọn bảng và khóa được tham chiếu…</option>
                        {referenceOptions.map(({ source, key }) => <option key={`${source.id}|${key.id}`} value={`${source.id}|${key.id}`}>{source.name}.{key.name}{key.pk ? " · PK" : " · UQ"}</option>)}
                      </select>}
                    </div>
                    );
                  })}
                </div>
                <button type="button" className="add-column" onClick={(event) => { event.stopPropagation(); updateEntity(entity.id, { columns: [...entity.columns, { id: makeId(), name: "new_column", type: "VARCHAR(255)", nullable: true }] }); }}>
                  <Icon name="plus" size={14} /><span>Thêm cột</span>
                </button>
              </article>
              );
            })}
            {entities.length === 0 && decorations.length === 0 && <div className="empty-canvas"><div className="empty-icon"><Icon name="table" size={24} /></div><h2>Sơ đồ đang trống</h2><p>Chọn thành phần trên thanh công cụ để bắt đầu thiết kế.</p><button type="button" className="primary-button" onClick={addEntity}><Icon name="plus" size={16} /> Thêm bảng đầu tiên</button></div>}
          </div>
        </div>
        {mode === "relation" && (
          <div className="canvas-tip">
            <span
              className="tip-pulse"
              style={{
                backgroundColor: relationType === "1 : 1" ? "#16a34a" : relationType === "1 : N" ? "#7c3aed" : "#db2777",
                boxShadow: `0 0 0 3px ${relationType === "1 : 1" ? "rgba(22,163,74,.25)" : relationType === "1 : N" ? "rgba(124,58,237,.25)" : "rgba(219,39,119,.25)"}`,
              }}
            />
            {relationType === "N : M" ? "Kéo bảng nguồn sang bảng đích để tự tạo bảng trung gian · " : "Kéo từ bảng nguồn sang bảng đích để nối · "}<strong style={{ color: relationType === "1 : 1" ? "#15803d" : relationType === "1 : N" ? "#6d28d9" : "#be185d" }}>{relationType} ({relationType === "1 : 1" ? "Xanh lá" : relationType === "1 : N" ? "Tím" : "Hồng"})</strong>
            <button type="button" aria-label="Thoát chế độ tạo quan hệ" onClick={() => { setMode("select"); relationDragRef.current = null; setLinkPreview(null); }}><Icon name="close" size={15} /></button>
          </div>
        )}
        <div className="canvas-controls">
          <button type="button" className="canvas-control" aria-label="Thu nhỏ sơ đồ" title="Thu nhỏ" onClick={() => zoomToAt(zoom - 0.1)}><Icon name="minus" size={16} /></button>
          <button type="button" className="canvas-zoom-value" aria-label="Đặt lại độ thu phóng" title="Đặt lại về 90%" onClick={() => zoomToAt(0.9)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="canvas-control" aria-label="Phóng to sơ đồ" title="Phóng to" onClick={() => zoomToAt(zoom + 0.1)}><Icon name="plus" size={16} /></button>
          <span className="control-separator" />
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
            ? "Tạo collections, JSON Schema validators và indexes theo các cột PK, FK, UNIQUE đã chọn; N:M trực tiếp tạo collection trung gian."
            : exportTarget === "supabase"
              ? "Tạo tables trong schema public của Supabase theo PK, FK, UNIQUE và kiểu dữ liệu trên sơ đồ. Quan hệ 1:N/1:1 dùng cột FK thật; N:M có thể dùng bảng trung gian."
              : "Tạo tables PostgreSQL theo PK, FK, UNIQUE, NULL và kiểu dữ liệu trên sơ đồ. Quan hệ 1:N/1:1 dùng cột FK thật; N:M có thể dùng bảng trung gian."}</p>
          <pre className="export-code"><code>{exportCode}</code></pre>
          <footer className="export-footer">
            <span>{exportTarget === "mongodb" ? "Tệp mongosh · .js" : "Tệp SQL · .sql"}</span>
            <div><button type="button" className="copy-button" onClick={copyExport}><Icon name={exportCopied ? "check" : "copy"} size={15} />{exportCopied ? "Đã sao chép" : "Sao chép"}</button><button type="button" className="share-button" onClick={downloadExport}><Icon name="download" size={15} /> Tải tệp</button></div>
          </footer>
        </section>
      </div>}

      <footer className="statusbar">
        <div className="status-left">
          <span className="status-indicator" />
          <span>{exportHint}</span>
          <span className="status-divider" />
          <span>{relations.length} quan hệ</span>
          <span className="status-divider" />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 9 }}>
            <span style={{ color: "#854d0e", fontWeight: 700 }}>● Bảng PK (Vàng)</span>
            <span style={{ color: "#9a3412", fontWeight: 700 }}>● Bảng FK (Đồng)</span>
            <span style={{ color: "#16a34a", fontWeight: 700 }}>● 1:1 (Xanh lá)</span>
            <span style={{ color: "#7c3aed", fontWeight: 700 }}>● 1:N (Tím)</span>
            <span style={{ color: "#db2777", fontWeight: 700 }}>● N:M (Hồng)</span>
          </span>
        </div>
        <div className="status-right"><span>{mode === "relation" ? `Kéo bảng để nối · ${relationType}` : "Kéo bảng hoặc ghi chú để di chuyển"}</span><span className="status-divider" /><span className="keyboard-hint">Phím tắt: <kbd>V</kbd> <kbd>T</kbd> <kbd>R</kbd> <kbd>N</kbd> <kbd>A</kbd> <kbd>G</kbd></span></div>
      </footer>
    </div>
  );
}
