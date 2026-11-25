export type ClosureStepRow = {
  id: string;
  step: number;
  fdApplied: string;
  resultSet: string;
};

export type ClosureBlock = {
  id: string;
  targetSet: string;
  rows: ClosureStepRow[];
  closureResult: string;
  equalsR: "equal" | "not_equal";
  explanation: string;
};

export type MinimalityRow = {
  id: string;
  candidateSet: string;
  closureNote: string;
  conclusion: string;
};

export type ClosureBoardState = {
  schemaAttrs: string;
  fdsText: string;
  requirement: string;
  rhsAttrs: string;
  notRhsAttrs: string;
  requiredAttrs: string;
  closureBlocks: ClosureBlock[];
  minimalityRows: MinimalityRow[];
  superkeys: string[];
  candidateKeysConclusion: string;
  superkeyCount: string;
};

export type ParsedFD = {
  lhs: string[];
  rhs: string[];
  raw: string;
};

let localSeq = 0;
export function nextBoardId(prefix = "row") {
  localSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${localSeq}`;
}

export function normalizeArrows(value: string) {
  return value.replaceAll("->", "→").replaceAll("=>", "→");
}

export function createDefaultBoardState(): ClosureBoardState {
  return {
    schemaAttrs: "",
    fdsText: "",
    requirement: "Tìm tất cả khóa ứng viên và siêu khóa.",
    rhsAttrs: "",
    notRhsAttrs: "",
    requiredAttrs: "",
    closureBlocks: [
      {
        id: "block-default",
        targetSet: "",
        rows: [
          { id: "step-0", step: 0, fdApplied: "Ban đầu", resultSet: "" },
        ],
        closureResult: "",
        equalsR: "equal",
        explanation:
          "Do bao đóng chứa toàn bộ thuộc tính của R nên tập đang xét là một siêu khóa.",
      },
    ],
    minimalityRows: [
      {
        id: "min-0",
        candidateSet: "",
        closureNote: "",
        conclusion: "",
      },
    ],
    superkeys: [""],
    candidateKeysConclusion: "",
    superkeyCount: "",
  };
}

export function createBlankFillState(current: ClosureBoardState): ClosureBoardState {
  return {
    ...current,
    rhsAttrs: "",
    notRhsAttrs: "",
    requiredAttrs: "",
    closureBlocks: [
      {
        id: nextBoardId("block"),
        targetSet: "",
        rows: [{ id: nextBoardId("step"), step: 0, fdApplied: "Ban đầu", resultSet: "" }],
        closureResult: "",
        equalsR: "equal",
        explanation:
          "Do bao đóng chứa toàn bộ thuộc tính của R nên tập đang xét là một siêu khóa.",
      },
    ],
    minimalityRows: [
      {
        id: nextBoardId("min"),
        candidateSet: "",
        closureNote: "",
        conclusion: "",
      },
    ],
    superkeys: [""],
    candidateKeysConclusion: "",
    superkeyCount: "",
  };
}

export function parseSchemaAttributes(input: string): string[] {
  const cleaned = input.replace(/^R\s*\(/i, "").replace(/\)\s*$/, "").trim();
  if (!cleaned) return [];
  const parts = cleaned.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part);
  }
  return unique;
}

export function parseAttrTokens(raw: string, schemaAttrs: string[]): string[] {
  const cleaned = raw.replace(/[{}\[\]()⁺+]/g, "").trim();
  if (!cleaned) return [];

  if (/[,;\s]/.test(cleaned)) {
    const tokens = cleaned.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
    return Array.from(new Set(tokens));
  }

  // If schema attributes are all single characters (e.g. A, B, C, D), allow compact notation like "AB" or "ABC"
  if (schemaAttrs.length > 0 && schemaAttrs.every((attr) => attr.length === 1)) {
    const tokens = cleaned.split("").filter((ch) => ch.trim().length > 0);
    return Array.from(new Set(tokens));
  }

  return [cleaned];
}

export function parseFDs(fdsText: string, schemaAttrs: string[]): ParsedFD[] {
  const cleaned = normalizeArrows(fdsText)
    .replace(/^[Ff]\s*=\s*\{?/, "")
    .replace(/\}\s*$/, "")
    .trim();
  if (!cleaned) return [];

  const chunks = cleaned.split(/[,;\n]+/).map((c) => c.trim()).filter(Boolean);
  const fds: ParsedFD[] = [];

  for (const chunk of chunks) {
    const arrowIdx = chunk.indexOf("→");
    if (arrowIdx === -1) continue;
    const lhsRaw = chunk.slice(0, arrowIdx).trim();
    const rhsRaw = chunk.slice(arrowIdx + 1).trim();
    const lhs = parseAttrTokens(lhsRaw, schemaAttrs);
    const rhs = parseAttrTokens(rhsRaw, schemaAttrs);
    if (lhs.length === 0 || rhs.length === 0) continue;
    fds.push({
      lhs,
      rhs,
      raw: `${formatCompact(lhs, schemaAttrs)} → ${formatCompact(rhs, schemaAttrs)}`,
    });
  }

  return fds;
}

export function sortBySchema(attrs: Iterable<string>, schemaAttrs: string[]): string[] {
  const order = new Map(schemaAttrs.map((attr, idx) => [attr, idx]));
  return Array.from(new Set(attrs)).sort((a, b) => {
    const ia = order.get(a);
    const ib = order.get(b);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a.localeCompare(b);
  });
}

export function formatCommaList(attrs: string[]): string {
  return attrs.join(", ");
}

export function formatSetBraces(attrs: string[]): string {
  return `{${attrs.join(", ")}}`;
}

export function formatCompact(attrs: string[], schemaAttrs: string[]): string {
  const sorted = sortBySchema(attrs, schemaAttrs);
  if (schemaAttrs.length > 0 && schemaAttrs.every((attr) => attr.length === 1)) {
    return sorted.join("");
  }
  return sorted.join(", ");
}

function isSubset(sub: string[], sup: Set<string>): boolean {
  return sub.every((item) => sup.has(item));
}

export function computeClosureTrace(
  seed: string[],
  fds: ParsedFD[],
  schemaAttrs: string[],
): { closure: string[]; rows: ClosureStepRow[] } {
  const current = new Set(sortBySchema(seed, schemaAttrs));
  const rows: ClosureStepRow[] = [
    {
      id: nextBoardId("step"),
      step: 0,
      fdApplied: "Ban đầu",
      resultSet: formatSetBraces(sortBySchema(current, schemaAttrs)),
    },
  ];

  let stepNum = 1;
  let changed = true;
  while (changed) {
    changed = false;
    for (const fd of fds) {
      if (isSubset(fd.lhs, current)) {
        const addsNew = fd.rhs.some((attr) => !current.has(attr));
        if (addsNew) {
          for (const attr of fd.rhs) current.add(attr);
          rows.push({
            id: nextBoardId("step"),
            step: stepNum++,
            fdApplied: fd.raw,
            resultSet: formatSetBraces(sortBySchema(current, schemaAttrs)),
          });
          changed = true;
        }
      }
    }
  }

  return {
    closure: sortBySchema(current, schemaAttrs),
    rows,
  };
}

export function applySingleFDToSetText(
  currentSetText: string,
  fdText: string,
  schemaAttrs: string[],
): string {
  const current = parseAttrTokens(currentSetText, schemaAttrs);
  const fds = parseFDs(fdText, schemaAttrs);
  const next = new Set(current);
  if (fds.length > 0) {
    for (const attr of fds[0].rhs) next.add(attr);
  }
  return formatSetBraces(sortBySchema(next, schemaAttrs));
}

function findCandidateKeys(
  schemaAttrs: string[],
  fds: ParsedFD[],
): {
  rhsAttrs: string[];
  requiredAttrs: string[];
  candidateKeys: string[][];
  testedSets: { attrs: string[]; closure: string[]; isSuperkey: boolean; isCandidate: boolean }[];
} {
  const lhsSet = new Set<string>();
  const rhsSet = new Set<string>();
  for (const fd of fds) {
    for (const a of fd.lhs) lhsSet.add(a);
    for (const a of fd.rhs) rhsSet.add(a);
  }

  const rhsAttrs = schemaAttrs.filter((a) => rhsSet.has(a));
  const requiredAttrs = schemaAttrs.filter((a) => !rhsSet.has(a));
  const middleAttrs = schemaAttrs.filter((a) => rhsSet.has(a) && lhsSet.has(a));

  const candidateKeys: string[][] = [];
  const testedSets: { attrs: string[]; closure: string[]; isSuperkey: boolean; isCandidate: boolean }[] = [];

  const requiredTrace = computeClosureTrace(requiredAttrs, fds, schemaAttrs);
  const requiredIsSuperkey = schemaAttrs.every((a) => requiredTrace.closure.includes(a));

  if (requiredAttrs.length > 0) {
    testedSets.push({
      attrs: requiredAttrs,
      closure: requiredTrace.closure,
      isSuperkey: requiredIsSuperkey,
      isCandidate: requiredIsSuperkey,
    });
  }

  if (requiredIsSuperkey && requiredAttrs.length > 0) {
    candidateKeys.push(requiredAttrs);
    return { rhsAttrs, requiredAttrs, candidateKeys, testedSets };
  }

  // BFS / increasing subset sizes of middleAttrs combined with requiredAttrs
  const maxK = middleAttrs.length;
  for (let size = requiredAttrs.length === 0 ? 1 : 1; size <= maxK; size++) {
    const combos: string[][] = [];
    const build = (start: number, acc: string[]) => {
      if (acc.length === size) {
        combos.push([...acc]);
        return;
      }
      for (let i = start; i < middleAttrs.length; i++) {
        acc.push(middleAttrs[i]);
        build(i + 1, acc);
        acc.pop();
      }
    };
    build(0, []);

    for (const combo of combos) {
      const candidate = sortBySchema([...requiredAttrs, ...combo], schemaAttrs);
      const candidateSet = new Set(candidate);
      const alreadyHasSubKey = candidateKeys.some((key) => isSubset(key, candidateSet));
      if (alreadyHasSubKey) continue;

      const trace = computeClosureTrace(candidate, fds, schemaAttrs);
      const isSuperkey = schemaAttrs.every((a) => trace.closure.includes(a));
      testedSets.push({
        attrs: candidate,
        closure: trace.closure,
        isSuperkey,
        isCandidate: isSuperkey,
      });
      if (isSuperkey) {
        candidateKeys.push(candidate);
      }
    }
  }

  return { rhsAttrs, requiredAttrs, candidateKeys, testedSets };
}

export function enumerateSuperkeys(
  schemaAttrs: string[],
  candidateKeys: string[][],
  maxDisplay = 256,
): { superkeys: string[]; totalCount: number } {
  if (schemaAttrs.length === 0 || candidateKeys.length === 0) {
    return { superkeys: [], totalCount: 0 };
  }

  const n = schemaAttrs.length;
  if (n > 14) {
    return { superkeys: candidateKeys.map((k) => formatCompact(k, schemaAttrs)), totalCount: -1 };
  }

  const totalMasks = 1 << n;
  const keyMasks = candidateKeys.map((key) => {
    let mask = 0;
    for (const attr of key) {
      const idx = schemaAttrs.indexOf(attr);
      if (idx >= 0) mask |= 1 << idx;
    }
    return mask;
  });

  const matched: { size: number; mask: number; label: string }[] = [];
  for (let mask = 1; mask < totalMasks; mask++) {
    const containsKey = keyMasks.some((km) => (mask & km) === km);
    if (!containsKey) continue;
    const attrs: string[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) attrs.push(schemaAttrs[i]);
    }
    matched.push({
      size: attrs.length,
      mask,
      label: formatCompact(attrs, schemaAttrs),
    });
  }

  matched.sort((a, b) => a.size - b.size || a.label.localeCompare(b.label));
  return {
    superkeys: matched.slice(0, maxDisplay).map((m) => m.label),
    totalCount: matched.length,
  };
}

export function solveClosureProblem(
  schemaAttrsInput: string,
  fdsInput: string,
  requirementInput: string,
): ClosureBoardState {
  const schemaAttrs = parseSchemaAttributes(schemaAttrsInput);
  const fds = parseFDs(fdsInput, schemaAttrs);

  if (schemaAttrs.length === 0) {
    return {
      ...createDefaultBoardState(),
      schemaAttrs: schemaAttrsInput,
      fdsText: normalizeArrows(fdsInput),
      requirement: requirementInput,
    };
  }

  const { rhsAttrs, requiredAttrs, candidateKeys, testedSets } = findCandidateKeys(schemaAttrs, fds);

  const closureBlocks: ClosureBlock[] = [];
  const setsToTrace =
    testedSets.length > 0
      ? testedSets.slice(0, 6)
      : [{ attrs: requiredAttrs, closure: requiredAttrs, isSuperkey: false, isCandidate: false }];

  for (const item of setsToTrace) {
    const trace = computeClosureTrace(item.attrs, fds, schemaAttrs);
    const equalsR = schemaAttrs.every((a) => trace.closure.includes(a));
    closureBlocks.push({
      id: nextBoardId("block"),
      targetSet: formatCompact(item.attrs, schemaAttrs) || "∅",
      rows: trace.rows,
      closureResult: formatSetBraces(trace.closure),
      equalsR: equalsR ? "equal" : "not_equal",
      explanation: equalsR
        ? "Do bao đóng chứa toàn bộ thuộc tính của R nên tập đang xét là một siêu khóa."
        : "Do bao đóng chưa chứa toàn bộ thuộc tính của R nên tập đang xét chưa phải là siêu khóa.",
    });
  }

  const minimalityRows: MinimalityRow[] = testedSets
    .filter((item) => item.isSuperkey)
    .map((item) => ({
      id: nextBoardId("min"),
      candidateSet: formatCompact(item.attrs, schemaAttrs),
      closureNote: `${formatSetBraces(item.closure)} = R`,
      conclusion: item.isCandidate ? "Khóa ứng viên" : "Không tối thiểu",
    }));

  if (minimalityRows.length === 0 && testedSets.length > 0) {
    minimalityRows.push({
      id: nextBoardId("min"),
      candidateSet: formatCompact(testedSets[0].attrs, schemaAttrs),
      closureNote: `${formatSetBraces(testedSets[0].closure)} ≠ R`,
      conclusion: "Không phải siêu khóa",
    });
  }

  const { superkeys, totalCount } = enumerateSuperkeys(schemaAttrs, candidateKeys);
  const candidateLabels = candidateKeys.map((k) => formatCompact(k, schemaAttrs));

  return {
    schemaAttrs: formatCommaList(schemaAttrs),
    fdsText: fds.length > 0 ? fds.map((fd) => fd.raw.replace(/\s*→\s*/, "→")).join(", ") : normalizeArrows(fdsInput),
    requirement: requirementInput || "Tìm tất cả khóa ứng viên và siêu khóa.",
    rhsAttrs: rhsAttrs.length > 0 ? formatCommaList(rhsAttrs) : "∅",
    notRhsAttrs: requiredAttrs.length > 0 ? formatCommaList(requiredAttrs) : "∅",
    requiredAttrs: requiredAttrs.length > 0 ? formatCommaList(requiredAttrs) : "∅",
    closureBlocks,
    minimalityRows,
    superkeys: superkeys.length > 0 ? superkeys : [""],
    candidateKeysConclusion: candidateLabels.join(", ") || "Không có",
    superkeyCount: totalCount >= 0 ? String(totalCount) : "Nhiều",
  };
}

export function formatBoardAsPlainText(state: ClosureBoardState): string {
  const lines: string[] = [];
  lines.push(`Cho lược đồ quan hệ R(${state.schemaAttrs}) với tập phụ thuộc hàm:`);
  lines.push(`F = {${state.fdsText}}`);
  lines.push(`Yêu cầu: ${state.requirement}`);
  lines.push("");
  lines.push("Bước 1. Xác định thuộc tính bắt buộc");
  lines.push(`Các thuộc tính xuất hiện ở vế phải: ${state.rhsAttrs}.`);
  lines.push(`Các thuộc tính không xuất hiện ở vế phải: ${state.notRhsAttrs}.`);
  lines.push(`Vì vậy, mọi khóa ứng viên đều phải chứa: ${state.requiredAttrs}.`);
  lines.push("");
  lines.push("Bước 2. Tính bao đóng");
  for (const block of state.closureBlocks) {
    lines.push("Lần\tPhụ thuộc hàm áp dụng\tTập thuộc tính sau khi áp dụng");
    for (const row of block.rows) {
      lines.push(`${row.step}\t${row.fdApplied}\t${row.resultSet}`);
    }
    lines.push("");
    const cmp = block.equalsR === "equal" ? "= R" : "≠ R";
    const targetDisplay = block.targetSet.includes(",") || block.targetSet.length > 1 ? `(${block.targetSet})` : block.targetSet;
    lines.push(`${targetDisplay}⁺ = ${block.closureResult} ${cmp}.`);
    lines.push(block.explanation);
    lines.push("");
  }
  lines.push("Bước 3. Kiểm tra tính tối thiểu");
  lines.push("Tập thuộc tính thử\tBao đóng / nhận xét\tKết luận");
  for (const row of state.minimalityRows) {
    lines.push(`${row.candidateSet}\t${row.closureNote}\t${row.conclusion}`);
  }
  lines.push("");
  lines.push("Tập nào có bao đóng bằng R và không thể bỏ bớt thuộc tính mà vẫn có bao đóng bằng R thì là khóa ứng viên.");
  lines.push("");
  lines.push("Bước 4. Liệt kê siêu khóa");
  lines.push("Mọi siêu khóa phải chứa ít nhất một khóa ứng viên. Các siêu khóa của bài này:");
  lines.push(state.superkeys.filter(Boolean).join("\t"));
  lines.push("");
  lines.push(`Kết luận: Khóa ứng viên: ${state.candidateKeysConclusion}. Có ${state.superkeyCount} siêu khóa.`);
  return lines.join("\n");
}
