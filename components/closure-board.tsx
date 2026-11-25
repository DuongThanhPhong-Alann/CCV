"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { readJsonResponse } from "@/lib/read-json-response";
import {
  applySingleFDToSetText,
  createBlankFillState,
  createDefaultBoardState,
  enumerateSuperkeys,
  formatBoardAsPlainText,
  formatCommaList,
  formatCompact,
  nextBoardId,
  normalizeArrows,
  parseAttrTokens,
  parseFDs,
  parseSchemaAttributes,
  solveClosureProblem,
  type ClosureBlock,
  type ClosureBoardState,
} from "@/lib/closure-solver";

type Account = { id: string; name: string | null; email: string | null };

const STORAGE_KEY = "erd_closure_board_v2";

const PRESET_EXAMPLES: { label: string; schemaAttrs: string; fdsText: string; requirement: string }[] = [
  {
    label: "Ví dụ 1: R(A, B, C) — 1 khóa ứng viên",
    schemaAttrs: "A, B, C",
    fdsText: "A→B, B→C",
    requirement: "Tìm tất cả khóa ứng viên và siêu khóa.",
  },
  {
    label: "Ví dụ 2: R(A, B, C, D) — Nhiều khóa ứng viên",
    schemaAttrs: "A, B, C, D",
    fdsText: "A→B, B→C, C→A",
    requirement: "Tìm tất cả khóa ứng viên và siêu khóa.",
  },
  {
    label: "Ví dụ 3: R(A, B, C, D, E) — Khóa ghép",
    schemaAttrs: "A, B, C, D, E",
    fdsText: "AB→C, C→D, D→E",
    requirement: "Tìm tất cả khóa ứng viên và siêu khóa.",
  },
];

function reindexRows<T extends { step: number }>(rows: T[]): T[] {
  return rows.map((row, index) => ({ ...row, step: index }));
}

export default function ClosureBoard() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<ClosureBoardState>(() => createDefaultBoardState());
  const [hydrated, setHydrated] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ClosureBoardState;
        if (parsed && Array.isArray(parsed.closureBlocks) && Array.isArray(parsed.minimalityRows)) {
          setBoard(parsed);
        }
      }
    } catch {
      // Ignore invalid local draft
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch {
      // Ignore storage quota errors
    }
  }, [board, hydrated]);

  useEffect(() => {
    let active = true;
    const loadAccount = async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const result = await readJsonResponse<{ user?: Account }>(response);
        if (active && result.user) setAccount(result.user);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadAccount();
    return () => {
      active = false;
    };
  }, [router]);

  const schemaAttrs = useMemo(() => parseSchemaAttributes(board.schemaAttrs), [board.schemaAttrs]);
  const parsedFDs = useMemo(() => parseFDs(board.fdsText, schemaAttrs), [board.fdsText, schemaAttrs]);

  const updateField = <K extends keyof ClosureBoardState>(key: K, value: ClosureBoardState[K]) => {
    setBoard((prev) => ({ ...prev, [key]: value }));
  };

  const handleAutoSolve = () => {
    setBoard((prev) => solveClosureProblem(prev.schemaAttrs, prev.fdsText, prev.requirement));
  };

  const handleFillStep1FromF = () => {
    const rhsSet = new Set<string>();
    for (const fd of parsedFDs) {
      for (const attr of fd.rhs) rhsSet.add(attr);
    }
    const rhs = schemaAttrs.filter((attr) => rhsSet.has(attr));
    const notRhs = schemaAttrs.filter((attr) => !rhsSet.has(attr));
    const rhsText = rhs.length > 0 ? formatCommaList(rhs) : "∅";
    const reqText = notRhs.length > 0 ? formatCommaList(notRhs) : "∅";
    const reqCompact = notRhs.length > 0 ? formatCompact(notRhs, schemaAttrs) : "∅";

    setBoard((prev) => ({
      ...prev,
      rhsAttrs: rhsText,
      notRhsAttrs: reqText,
      requiredAttrs: reqCompact,
    }));
  };

  const handleAutoSuperkeys = () => {
    const candidateStrings = board.minimalityRows
      .filter((row) => row.conclusion.toLowerCase().includes("khóa ứng viên"))
      .map((row) => row.candidateSet)
      .filter(Boolean);

    const fallbackKeys = candidateStrings.length > 0
      ? candidateStrings
      : board.candidateKeysConclusion
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);

    const keySets = fallbackKeys
      .map((k) => parseAttrTokens(k, schemaAttrs))
      .filter((tokens) => tokens.length > 0);

    if (schemaAttrs.length === 0 || keySets.length === 0) return;

    const { superkeys, totalCount } = enumerateSuperkeys(schemaAttrs, keySets);
    setBoard((prev) => ({
      ...prev,
      superkeys: superkeys.length > 0 ? superkeys : [""],
      candidateKeysConclusion: fallbackKeys.join(", "),
      superkeyCount: totalCount >= 0 ? String(totalCount) : prev.superkeyCount,
    }));
  };

  const updateBlock = (blockId: string, updater: (block: ClosureBlock) => ClosureBlock) => {
    setBoard((prev) => ({
      ...prev,
      closureBlocks: prev.closureBlocks.map((block) => (block.id === blockId ? updater(block) : block)),
    }));
  };

  const addStepRow = (blockId: string, fdOverride?: string) => {
    updateBlock(blockId, (block) => {
      const lastRow = block.rows[block.rows.length - 1];
      const nextStep = block.rows.length;
      const seedText = lastRow?.resultSet || (block.targetSet ? `{${block.targetSet}}` : "");
      const nextResult = fdOverride
        ? applySingleFDToSetText(seedText, fdOverride, schemaAttrs)
        : lastRow?.resultSet ?? "";

      const nextRows = [
        ...block.rows,
        {
          id: nextBoardId("step"),
          step: nextStep,
          fdApplied: fdOverride ?? "",
          resultSet: nextResult,
        },
      ];

      const closureTokens = parseAttrTokens(nextResult, schemaAttrs);
      const allCovered =
        schemaAttrs.length > 0 && schemaAttrs.every((attr) => closureTokens.includes(attr));

      return {
        ...block,
        rows: nextRows,
        closureResult: fdOverride ? nextResult : block.closureResult,
        equalsR: fdOverride ? (allCovered ? "equal" : "not_equal") : block.equalsR,
        explanation: fdOverride
          ? allCovered
            ? "Do bao đóng chứa toàn bộ thuộc tính của R nên tập đang xét là một siêu khóa."
            : "Do bao đóng chưa chứa toàn bộ thuộc tính của R nên tập đang xét chưa phải là siêu khóa."
          : block.explanation,
      };
    });
  };

  const removeStepRow = (blockId: string, rowId: string) => {
    updateBlock(blockId, (block) => {
      if (block.rows.length <= 1) return block;
      return {
        ...block,
        rows: reindexRows(block.rows.filter((row) => row.id !== rowId)),
      };
    });
  };

  const addClosureBlock = () => {
    setBoard((prev) => ({
      ...prev,
      closureBlocks: [
        ...prev.closureBlocks,
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
    }));
  };

  const removeClosureBlock = (blockId: string) => {
    setBoard((prev) => {
      if (prev.closureBlocks.length <= 1) return prev;
      return {
        ...prev,
        closureBlocks: prev.closureBlocks.filter((b) => b.id !== blockId),
      };
    });
  };

  const addMinimalityRow = () => {
    setBoard((prev) => ({
      ...prev,
      minimalityRows: [
        ...prev.minimalityRows,
        {
          id: nextBoardId("min"),
          candidateSet: "",
          closureNote: "",
          conclusion: "",
        },
      ],
    }));
  };

  const removeMinimalityRow = (rowId: string) => {
    setBoard((prev) => {
      if (prev.minimalityRows.length <= 1) return prev;
      return {
        ...prev,
        minimalityRows: prev.minimalityRows.filter((row) => row.id !== rowId),
      };
    });
  };

  const addSuperkeyCell = () => {
    setBoard((prev) => {
      const next = [...prev.superkeys, ""];
      return {
        ...prev,
        superkeys: next,
        superkeyCount: String(next.filter((s) => s.trim().length > 0).length || next.length),
      };
    });
  };

  const updateSuperkeyCell = (index: number, value: string) => {
    setBoard((prev) => {
      const next = prev.superkeys.map((item, idx) => (idx === index ? value : item));
      return {
        ...prev,
        superkeys: next,
        superkeyCount: String(next.filter((s) => s.trim().length > 0).length),
      };
    });
  };

  const removeSuperkeyCell = (index: number) => {
    setBoard((prev) => {
      if (prev.superkeys.length <= 1) return prev;
      const next = prev.superkeys.filter((_, idx) => idx !== index);
      return {
        ...prev,
        superkeys: next,
        superkeyCount: String(next.filter((s) => s.trim().length > 0).length),
      };
    });
  };

  const handleCopyPlainText = async () => {
    try {
      await navigator.clipboard.writeText(formatBoardAsPlainText(board));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <span className="loading-spinner" />
        <p>Đang tải bảng giải bài tập…</p>
      </div>
    );
  }

  return (
    <main className={`closure-page ${presentationMode ? "is-presenting" : ""}`}>
      <header className="dashboard-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link className="dashboard-brand" href="/">
            <Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized />
          </Link>
          <nav className="dashboard-topnav">
            <Link className="topnav-tab" href="/">📁 Sơ đồ của tôi</Link>
            <Link className="topnav-tab" href="/tasks">📝 Bài tập</Link>
            <Link className="topnav-tab active" href="/closure">🔑 Tìm siêu khóa</Link>
          </nav>
        </div>
        <div className="dashboard-user">
          <div className="user-avatar">{(account?.name || account?.email || "U").slice(0, 1).toUpperCase()}</div>
          <div className="user-details">
            <strong>{account?.name || "Tài khoản"}</strong>
            <span>{account?.email}</span>
          </div>
          <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
        </div>
      </header>

      <section className="closure-content">
        <div className="closure-heading">
          <div>
            <span className="dashboard-eyebrow">PHƯƠNG PHÁP BAO ĐÓNG</span>
            <h1>Bảng giải bài tập tìm khóa &amp; siêu khóa</h1>
            <p>Khung chuẩn giữ nguyên phần cố định — chỉ cần nhập đề bài và các ô thay đổi khi giảng dạy.</p>
          </div>
          <div className="closure-toolbar">
            <select
              className="closure-preset-select"
              aria-label="Chọn bài tập mẫu"
              value=""
              onChange={(event) => {
                const chosen = PRESET_EXAMPLES[Number(event.target.value)];
                if (!chosen) return;
                setBoard(solveClosureProblem(chosen.schemaAttrs, chosen.fdsText, chosen.requirement));
              }}
            >
              <option value="" disabled>📚 Chọn ví dụ mẫu…</option>
              {PRESET_EXAMPLES.map((preset, idx) => (
                <option key={preset.label} value={idx}>{preset.label}</option>
              ))}
            </select>
            <button type="button" className="closure-btn closure-btn-primary" onClick={handleAutoSolve} title="Tự động tính toàn bộ 4 bước từ R và F">
              ⚡ Tự động giải từ R, F
            </button>
            <button
              type="button"
              className="closure-btn"
              onClick={() => setBoard((prev) => createBlankFillState(prev))}
              title="Xóa phần bài giải để giảng từng bước, giữ nguyên R, F và tựa đề"
            >
              🧹 Xóa phần giải (giữ R, F)
            </button>
            <button
              type="button"
              className="closure-btn"
              onClick={() => setBoard(createDefaultBoardState())}
              title="Đặt lại toàn bộ về trang trống chỉ có tựa đề và khung cố định"
            >
              ↺ Trang trống
            </button>
            <button
              type="button"
              className={`closure-btn ${presentationMode ? "active" : ""}`}
              onClick={() => setPresentationMode((v) => !v)}
              title="Ẩn các nút phụ để trình chiếu gọn đẹp"
            >
              {presentationMode ? "✏️ Hiện nút sửa" : "📽️ Trình chiếu"}
            </button>
            <button type="button" className="closure-btn" onClick={() => void handleCopyPlainText()}>
              {copied ? "✓ Đã sao chép" : "📋 Sao chép bài"}
            </button>
          </div>
        </div>

        <article className="closure-sheet">
          {/* ĐỀ BÀI */}
          <section className="closure-problem-box">
            <div className="closure-problem-line">
              <span>Cho lược đồ quan hệ</span>
              <span className="math-wrap">
                <strong>R(</strong>
                <input
                  className="closure-inline-input closure-input-schema"
                  aria-label="Tập thuộc tính của lược đồ R"
                  value={board.schemaAttrs}
                  onChange={(e) => updateField("schemaAttrs", e.target.value)}
                  placeholder="A, B, C..."
                />
                <strong>)</strong>
              </span>
              <span>với tập phụ thuộc hàm:</span>
            </div>

            <div className="closure-problem-line">
              <span className="math-wrap">
                <strong>F = {"{"}</strong>
                <input
                  className="closure-inline-input closure-input-fds"
                  aria-label="Tập phụ thuộc hàm F"
                  value={board.fdsText}
                  onChange={(e) => updateField("fdsText", normalizeArrows(e.target.value))}
                  placeholder="A→B, B→C..."
                />
                <strong>{"}"}</strong>
              </span>
              {!presentationMode && (
                <button
                  type="button"
                  className="closure-mini-chip"
                  onClick={() => updateField("fdsText", `${board.fdsText}${board.fdsText && !board.fdsText.endsWith("→") ? "→" : ""}`)}
                  title="Chèn dấu mũi tên → (hoặc gõ -> để tự đổi)"
                >
                  Chèn →
                </button>
              )}
            </div>

            <div className="closure-problem-line">
              <strong>Yêu cầu:</strong>
              <input
                className="closure-inline-input closure-input-wide"
                aria-label="Yêu cầu bài tập"
                value={board.requirement}
                onChange={(e) => updateField("requirement", e.target.value)}
                placeholder="Tìm tất cả khóa ứng viên và siêu khóa."
              />
            </div>
          </section>

          {/* BƯỚC 1 */}
          <section className="closure-step">
            <div className="closure-step-header">
              <h2>Bước 1. Xác định thuộc tính bắt buộc</h2>
              {!presentationMode && (
                <button type="button" className="closure-step-helper" onClick={handleFillStep1FromF}>
                  ⚡ Điền từ F
                </button>
              )}
            </div>
            <div className="closure-step1-lines">
              <p>
                <span>Các thuộc tính xuất hiện ở vế phải:</span>
                <input
                  className="closure-inline-input closure-input-attrs"
                  aria-label="Các thuộc tính xuất hiện ở vế phải"
                  value={board.rhsAttrs}
                  onChange={(e) => updateField("rhsAttrs", e.target.value)}
                  placeholder=""
                />
                <span>.</span>
              </p>
              <p>
                <span>Các thuộc tính không xuất hiện ở vế phải:</span>
                <input
                  className="closure-inline-input closure-input-attrs"
                  aria-label="Các thuộc tính không xuất hiện ở vế phải"
                  value={board.notRhsAttrs}
                  onChange={(e) => updateField("notRhsAttrs", e.target.value)}
                  placeholder=""
                />
                <span>.</span>
              </p>
              <p className="closure-highlight-line">
                <span>Vì vậy, mọi khóa ứng viên đều phải chứa:</span>
                <input
                  className="closure-inline-input closure-input-attrs closure-input-strong"
                  aria-label="Thuộc tính bắt buộc phải chứa"
                  value={board.requiredAttrs}
                  onChange={(e) => updateField("requiredAttrs", e.target.value)}
                  placeholder=""
                />
                <span>.</span>
              </p>
            </div>
          </section>

          {/* BƯỚC 2 */}
          <section className="closure-step">
            <div className="closure-step-header">
              <h2>Bước 2. Tính bao đóng</h2>
              {!presentationMode && (
                <button type="button" className="closure-step-helper" onClick={addClosureBlock}>
                  ＋ Thêm bảng bao đóng
                </button>
              )}
            </div>

            <div className="closure-blocks-stack">
              {board.closureBlocks.map((block, blockIdx) => {
                const targetDisplay =
                  block.targetSet.includes(",") || block.targetSet.trim().length > 1
                    ? `(${block.targetSet})`
                    : block.targetSet || "…";

                return (
                  <div className="closure-block" key={block.id}>
                    {board.closureBlocks.length > 1 && (
                      <div className="closure-block-bar">
                        <span>Bảng bao đóng #{blockIdx + 1}</span>
                        {!presentationMode && (
                          <button
                            type="button"
                            className="closure-row-delete"
                            onClick={() => removeClosureBlock(block.id)}
                          >
                            Xóa bảng
                          </button>
                        )}
                      </div>
                    )}

                    {!presentationMode && parsedFDs.length > 0 && (
                      <div className="closure-quick-fds">
                        <span className="quick-fds-label">Áp dụng nhanh lần tiếp theo:</span>
                        {parsedFDs.map((fd) => (
                          <button
                            key={`${block.id}-${fd.raw}`}
                            type="button"
                            className="closure-mini-chip"
                            onClick={() => addStepRow(block.id, fd.raw)}
                            title={`Thêm lần áp dụng ${fd.raw} và tự hợp vào tập thuộc tính`}
                          >
                            ＋ {fd.raw}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="closure-table-wrap">
                      <table className="closure-table">
                        <thead>
                          <tr>
                            <th style={{ width: 76 }}>Lần</th>
                            <th style={{ width: "36%" }}>Phụ thuộc hàm áp dụng</th>
                            <th>Tập thuộc tính sau khi áp dụng</th>
                            {!presentationMode && <th style={{ width: 46 }} aria-label="Thao tác" />}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row) => (
                            <tr key={row.id}>
                              <td className="closure-cell-step">
                                <input
                                  className="closure-table-input closure-input-center"
                                  aria-label={`Lần thứ ${row.step}`}
                                  value={String(row.step)}
                                  onChange={(e) => {
                                    const num = Number.parseInt(e.target.value, 10);
                                    updateBlock(block.id, (b) => ({
                                      ...b,
                                      rows: b.rows.map((r) =>
                                        r.id === row.id ? { ...r, step: Number.isNaN(num) ? 0 : num } : r,
                                      ),
                                    }));
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  className="closure-table-input"
                                  aria-label={`Phụ thuộc hàm áp dụng lần ${row.step}`}
                                  value={row.fdApplied}
                                  placeholder={row.step === 0 ? "Ban đầu" : ""}
                                  onChange={(e) => {
                                    const val = normalizeArrows(e.target.value);
                                    updateBlock(block.id, (b) => ({
                                      ...b,
                                      rows: b.rows.map((r) => (r.id === row.id ? { ...r, fdApplied: val } : r)),
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      addStepRow(block.id);
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  className="closure-table-input closure-input-mono"
                                  aria-label={`Tập thuộc tính sau lần ${row.step}`}
                                  value={row.resultSet}
                                  placeholder="{...}"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateBlock(block.id, (b) => ({
                                      ...b,
                                      rows: b.rows.map((r) => (r.id === row.id ? { ...r, resultSet: val } : r)),
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      addStepRow(block.id);
                                    }
                                  }}
                                />
                              </td>
                              {!presentationMode && (
                                <td className="closure-cell-actions">
                                  <button
                                    type="button"
                                    className="closure-row-remove"
                                    disabled={block.rows.length <= 1}
                                    title="Xóa lần này"
                                    onClick={() => removeStepRow(block.id, row.id)}
                                  >
                                    ×
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {!presentationMode && (
                      <div className="closure-table-footer">
                        <button type="button" className="closure-add-row-btn" onClick={() => addStepRow(block.id)}>
                          ＋ Thêm lần
                        </button>
                      </div>
                    )}

                    <div className="closure-step2-conclusion">
                      <p className="closure-formula-line">
                        <span className="math-wrap">
                          <input
                            className="closure-inline-input closure-input-target"
                            aria-label="Tập thuộc tính lấy bao đóng"
                            value={block.targetSet}
                            placeholder=""
                            onChange={(e) =>
                              updateBlock(block.id, (b) => ({ ...b, targetSet: e.target.value }))
                            }
                            title={`Hiển thị: ${targetDisplay}⁺`}
                          />
                          <strong>⁺ =</strong>
                        </span>
                        <input
                          className="closure-inline-input closure-input-attrs closure-input-mono"
                          aria-label="Kết quả bao đóng"
                          value={block.closureResult}
                          placeholder="{...}"
                          onChange={(e) =>
                            updateBlock(block.id, (b) => ({ ...b, closureResult: e.target.value }))
                          }
                        />
                        {presentationMode ? (
                          <strong>{block.equalsR === "equal" ? "= R." : "≠ R."}</strong>
                        ) : (
                          <button
                            type="button"
                            className={`closure-eq-toggle ${block.equalsR === "equal" ? "is-eq" : "is-neq"}`}
                            onClick={() =>
                              updateBlock(block.id, (b) => {
                                const nextEq = b.equalsR === "equal" ? "not_equal" : "equal";
                                return {
                                  ...b,
                                  equalsR: nextEq,
                                  explanation:
                                    nextEq === "equal"
                                      ? "Do bao đóng chứa toàn bộ thuộc tính của R nên tập đang xét là một siêu khóa."
                                      : "Do bao đóng chưa chứa toàn bộ thuộc tính của R nên tập đang xét chưa phải là siêu khóa.",
                                };
                              })
                            }
                            title="Bấm để đổi giữa = R và ≠ R"
                          >
                            {block.equalsR === "equal" ? "= R" : "≠ R"}
                          </button>
                        )}
                      </p>

                      <input
                        className="closure-explanation-input"
                        aria-label="Nhận xét bao đóng"
                        value={block.explanation}
                        onChange={(e) =>
                          updateBlock(block.id, (b) => ({ ...b, explanation: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* BƯỚC 3 */}
          <section className="closure-step">
            <div className="closure-step-header">
              <h2>Bước 3. Kiểm tra tính tối thiểu</h2>
            </div>

            <div className="closure-table-wrap">
              <table className="closure-table">
                <thead>
                  <tr>
                    <th style={{ width: "26%" }}>Tập thuộc tính thử</th>
                    <th style={{ width: "44%" }}>Bao đóng / nhận xét</th>
                    <th>Kết luận</th>
                    {!presentationMode && <th style={{ width: 46 }} aria-label="Thao tác" />}
                  </tr>
                </thead>
                <tbody>
                  {board.minimalityRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          className="closure-table-input closure-input-strong"
                          aria-label="Tập thuộc tính thử"
                          value={row.candidateSet}
                          placeholder=""
                          onChange={(e) =>
                            setBoard((prev) => ({
                              ...prev,
                              minimalityRows: prev.minimalityRows.map((r) =>
                                r.id === row.id ? { ...r, candidateSet: e.target.value } : r,
                              ),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="closure-table-input closure-input-mono"
                          aria-label="Bao đóng hoặc nhận xét"
                          value={row.closureNote}
                          placeholder=""
                          onChange={(e) =>
                            setBoard((prev) => ({
                              ...prev,
                              minimalityRows: prev.minimalityRows.map((r) =>
                                r.id === row.id ? { ...r, closureNote: e.target.value } : r,
                              ),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="closure-table-input"
                          list="minimality-conclusions"
                          aria-label="Kết luận"
                          value={row.conclusion}
                          placeholder=""
                          onChange={(e) =>
                            setBoard((prev) => ({
                              ...prev,
                              minimalityRows: prev.minimalityRows.map((r) =>
                                r.id === row.id ? { ...r, conclusion: e.target.value } : r,
                              ),
                            }))
                          }
                        />
                      </td>
                      {!presentationMode && (
                        <td className="closure-cell-actions">
                          <button
                            type="button"
                            className="closure-row-remove"
                            disabled={board.minimalityRows.length <= 1}
                            title="Xóa dòng này"
                            onClick={() => removeMinimalityRow(row.id)}
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="minimality-conclusions">
                <option value="Khóa ứng viên" />
                <option value="Không tối thiểu" />
                <option value="Không phải siêu khóa" />
              </datalist>
            </div>

            {!presentationMode && (
              <div className="closure-table-footer">
                <button type="button" className="closure-add-row-btn" onClick={addMinimalityRow}>
                  ＋ Thêm tập thử
                </button>
              </div>
            )}

            <p className="closure-rule-note">
              Tập nào có bao đóng bằng R và không thể bỏ bớt thuộc tính mà vẫn có bao đóng bằng R thì là khóa ứng viên.
            </p>
          </section>

          {/* BƯỚC 4 */}
          <section className="closure-step">
            <div className="closure-step-header">
              <h2>Bước 4. Liệt kê siêu khóa</h2>
              {!presentationMode && (
                <button type="button" className="closure-step-helper" onClick={handleAutoSuperkeys}>
                  ⚡ Tự liệt kê siêu khóa
                </button>
              )}
            </div>

            <p className="closure-step4-intro">
              Mọi siêu khóa phải chứa ít nhất một khóa ứng viên. Các siêu khóa của bài này:
            </p>

            <div className="superkey-grid" role="list" aria-label="Danh sách siêu khóa">
              {board.superkeys.map((sk, index) => (
                <div className="superkey-cell" role="listitem" key={`sk-${index}`}>
                  <input
                    className="superkey-cell-input"
                    aria-label={`Siêu khóa ${index + 1}`}
                    value={sk}
                    placeholder=""
                    onChange={(e) => updateSuperkeyCell(index, e.target.value)}
                  />
                  {!presentationMode && board.superkeys.length > 1 && (
                    <button
                      type="button"
                      className="superkey-cell-remove"
                      aria-label={`Xóa siêu khóa ${sk || index + 1}`}
                      onClick={() => removeSuperkeyCell(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!presentationMode && (
                <button type="button" className="superkey-add-cell" onClick={addSuperkeyCell}>
                  ＋ Thêm siêu khóa
                </button>
              )}
            </div>

            <div className="closure-final-conclusion">
              <strong>Kết luận:</strong>
              <span>Khóa ứng viên:</span>
              <input
                className="closure-inline-input closure-input-attrs closure-input-strong"
                aria-label="Kết luận khóa ứng viên"
                value={board.candidateKeysConclusion}
                onChange={(e) => updateField("candidateKeysConclusion", e.target.value)}
                placeholder=""
              />
              <span>. Có</span>
              <input
                className="closure-inline-input closure-input-count"
                aria-label="Số lượng siêu khóa"
                value={board.superkeyCount}
                onChange={(e) => updateField("superkeyCount", e.target.value)}
                placeholder=""
              />
              <span>siêu khóa.</span>
            </div>
          </section>
        </article>
      </section>
    </main>
  );
}
