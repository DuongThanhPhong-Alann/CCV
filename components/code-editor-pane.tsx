"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import {
  createFileId,
  detectFileLanguage,
  filesToCodeBundle,
  normalizeCodeFiles,
} from "@/lib/code-grader";
import type { CodeBundle, CodeFile, CodeFileLanguage } from "@/lib/code-task-types";

type CodeEditorPaneProps = {
  value: CodeBundle;
  onChange?: (next: CodeBundle) => void;
  readOnly?: boolean;
  onRunShortcut?: () => void;
  onSaveShortcut?: () => void;
  height?: number;
  label?: string;
  workspaceName?: string;
};

function FileIcon({ language }: { language: CodeFileLanguage }) {
  if (language === "html") {
    return (
      <span className="vscode-file-icon icon-html" title="HTML">
        &lt;/&gt;
      </span>
    );
  }
  if (language === "css") {
    return (
      <span className="vscode-file-icon icon-css" title="CSS">
        #
      </span>
    );
  }
  if (language === "js") {
    return (
      <span className="vscode-file-icon icon-js" title="JavaScript">
        JS
      </span>
    );
  }
  if (language === "json") {
    return (
      <span className="vscode-file-icon icon-json" title="JSON">
        {"{}"}
      </span>
    );
  }
  if (language === "md") {
    return (
      <span className="vscode-file-icon icon-md" title="Markdown">
        M↓
      </span>
    );
  }
  return (
    <span className="vscode-file-icon icon-txt" title="Text">
      TXT
    </span>
  );
}

const LANG_DISPLAY: Record<CodeFileLanguage, string> = {
  html: "HTML",
  css: "CSS",
  js: "JavaScript",
  json: "JSON",
  md: "Markdown",
  txt: "Plain Text",
};

export default function CodeEditorPane({
  value,
  onChange,
  readOnly = false,
  onRunShortcut,
  onSaveShortcut,
  height = 420,
  label,
  workspaceName = "BAITAP-WEB",
}: CodeEditorPaneProps) {
  const files = useMemo(() => normalizeCodeFiles(value), [value]);
  const [activeFileId, setActiveFileId] = useState<string>(() => files[0]?.id ?? "file_html");
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => files.map((f) => f.id));
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [fileError, setFileError] = useState("");
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const effectiveActiveId = files.some((f) => f.id === activeFileId)
    ? activeFileId
    : (files[0]?.id ?? "");

  const validTabIds = openTabIds.filter((id) => files.some((f) => f.id === id));
  const effectiveTabIds = validTabIds.length > 0 ? validTabIds : files.map((f) => f.id);

  const activeFile = files.find((f) => f.id === effectiveActiveId) ?? files[0];
  const currentText = activeFile?.content ?? "";
  const lineCount = Math.max(1, currentText.split("\n").length);

  const updateFiles = (nextFiles: CodeFile[]) => {
    if (!onChange) return;
    onChange(filesToCodeBundle(nextFiles));
  };

  const openFile = (fileId: string) => {
    setActiveFileId(fileId);
    setOpenTabIds((prev) => {
      const base = prev.filter((id) => files.some((f) => f.id === id));
      const current = base.length > 0 ? base : files.map((f) => f.id);
      return current.includes(fileId) ? current : [...current, fileId];
    });
  };

  const closeTab = (fileId: string) => {
    if (effectiveTabIds.length <= 1) return;
    const nextTabs = effectiveTabIds.filter((id) => id !== fileId);
    setOpenTabIds(nextTabs);
    if (effectiveActiveId === fileId) {
      setActiveFileId(nextTabs[nextTabs.length - 1] ?? files[0]?.id ?? "");
    }
  };

  const handleCreateFile = () => {
    if (readOnly) return;
    const trimmed = newFileName.trim().replace(/[\\/:*?"<>|]/g, "_");
    if (!trimmed) {
      setCreatingFile(false);
      setFileError("");
      return;
    }
    const finalName = trimmed.includes(".") ? trimmed : `${trimmed}.js`;
    if (files.some((f) => f.name.toLowerCase() === finalName.toLowerCase())) {
      setFileError(`File "${finalName}" đã tồn tại.`);
      return;
    }
    const created: CodeFile = {
      id: createFileId(),
      name: finalName,
      language: detectFileLanguage(finalName),
      content: "",
    };
    const nextFiles = [...files, created];
    updateFiles(nextFiles);
    setOpenTabIds([...effectiveTabIds, created.id]);
    setActiveFileId(created.id);
    setNewFileName("");
    setCreatingFile(false);
    setFileError("");
  };

  const handleRenameSubmit = (fileId: string) => {
    if (readOnly) return;
    const trimmed = renameText.trim().replace(/[\\/:*?"<>|]/g, "_");
    setRenamingId(null);
    if (!trimmed) return;
    if (files.some((f) => f.id !== fileId && f.name.toLowerCase() === trimmed.toLowerCase())) {
      setFileError(`File "${trimmed}" đã tồn tại.`);
      return;
    }
    const nextFiles = files.map((f) =>
      f.id === fileId
        ? { ...f, name: trimmed, language: detectFileLanguage(trimmed) }
        : f,
    );
    updateFiles(nextFiles);
    setFileError("");
  };

  const handleDeleteFile = (file: CodeFile) => {
    if (readOnly || files.length <= 1) return;
    if (!window.confirm(`Xóa file "${file.name}"?`)) return;
    const nextFiles = files.filter((f) => f.id !== file.id);
    const nextTabs = effectiveTabIds.filter((id) => id !== file.id);
    updateFiles(nextFiles);
    setOpenTabIds(nextTabs.length ? nextTabs : nextFiles.slice(0, 1).map((f) => f.id));
    if (effectiveActiveId === file.id) {
      setActiveFileId(nextTabs[0] ?? nextFiles[0]?.id ?? "");
    }
  };

  const syncCursor = (el: HTMLTextAreaElement) => {
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const lines = before.split("\n");
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && onRunShortcut) {
      event.preventDefault();
      onRunShortcut();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && onSaveShortcut) {
      event.preventDefault();
      onSaveShortcut();
      return;
    }
    if (!readOnly && onChange && activeFile && event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextText = currentText.slice(0, start) + "  " + currentText.slice(end);
      updateFiles(files.map((f) => (f.id === activeFile.id ? { ...f, content: nextText } : f)));
      window.requestAnimationFrame(() => {
        target.selectionStart = start + 2;
        target.selectionEnd = start + 2;
        syncCursor(target);
      });
    }
  };

  const visibleTabs = effectiveTabIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is CodeFile => Boolean(f));

  return (
    <div className="vscode-shell">
      {/* Explorer + Editor split */}
      <div className="vscode-main" style={{ height }}>
        {/* Activity Strip */}
        <div className="vscode-activity-bar">
          <button
            type="button"
            className={`vscode-activity-btn ${sidebarOpen ? "active" : ""}`}
            onClick={() => setSidebarOpen((v) => !v)}
            title="Ẩn/hiện Explorer"
          >
            📁
          </button>
        </div>

        {/* Explorer Sidebar */}
        {sidebarOpen && (
          <aside className="vscode-explorer" aria-label="Trình quản lý file">
            <div className="vscode-explorer-header">
              <span>EXPLORER</span>
              {!readOnly && (
                <button
                  type="button"
                  className="vscode-new-file-btn"
                  title="Tạo file mới (ví dụ: utils.js, theme.css)"
                  onClick={() => {
                    setCreatingFile(true);
                    setFileError("");
                  }}
                >
                  ＋ File
                </button>
              )}
            </div>

            <div className="vscode-folder-row">
              <span>▾</span>
              <span>📂 {workspaceName}</span>
            </div>

            {creatingFile && !readOnly && (
              <div className="vscode-inline-create">
                <input
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateFile();
                    } else if (e.key === "Escape") {
                      setCreatingFile(false);
                      setNewFileName("");
                      setFileError("");
                    }
                  }}
                  onBlur={handleCreateFile}
                  placeholder="tenfile.js / .css / .html"
                />
              </div>
            )}

            {fileError && <div className="vscode-file-error">{fileError}</div>}

            <ul className="vscode-file-tree">
              {files.map((file) => {
                const isActive = activeFile?.id === file.id;
                return (
                  <li
                    key={file.id}
                    className={`vscode-file-item ${isActive ? "active" : ""}`}
                  >
                    {renamingId === file.id && !readOnly ? (
                      <input
                        className="vscode-rename-input"
                        autoFocus
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRenameSubmit(file.id);
                          } else if (e.key === "Escape") {
                            setRenamingId(null);
                          }
                        }}
                        onBlur={() => handleRenameSubmit(file.id)}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className="vscode-file-open-btn"
                          onClick={() => openFile(file.id)}
                        >
                          <FileIcon language={file.language} />
                          <span className="vscode-file-name">{file.name}</span>
                        </button>
                        {!readOnly && (
                          <div className="vscode-file-actions">
                            <button
                              type="button"
                              title="Đổi tên file"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingId(file.id);
                                setRenameText(file.name);
                              }}
                            >
                              ✎
                            </button>
                            {files.length > 1 && (
                              <button
                                type="button"
                                title="Xóa file"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(file);
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* Editor Column */}
        <div className="vscode-editor-col">
          {/* Open File Tabs */}
          <div className="vscode-tabs-bar" role="tablist">
            <div className="vscode-tabs-scroll">
              {visibleTabs.map((file) => {
                const isActive = activeFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    className={`vscode-tab ${isActive ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className="vscode-tab-btn"
                      onClick={() => setActiveFileId(file.id)}
                    >
                      <FileIcon language={file.language} />
                      <span>{file.name}</span>
                    </button>
                    {visibleTabs.length > 1 && (
                      <button
                        type="button"
                        className="vscode-tab-close"
                        aria-label={`Đóng tab ${file.name}`}
                        onClick={() => closeTab(file.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="vscode-tabs-meta">
              {label && <span className="code-editor-label">{label}</span>}
            </div>
          </div>

          {/* Code Textarea + Gutter */}
          <div className="code-editor-body vscode-code-body">
            <div className="code-line-numbers" aria-hidden="true">
              {Array.from({ length: lineCount }, (_, idx) => (
                <span key={idx}>{idx + 1}</span>
              ))}
            </div>
            <textarea
              className="code-textarea"
              spellCheck={false}
              readOnly={readOnly}
              value={currentText}
              onKeyDown={handleKeyDown}
              onClick={(e) => syncCursor(e.currentTarget)}
              onKeyUp={(e) => syncCursor(e.currentTarget)}
              onChange={(event) => {
                if (!readOnly && onChange && activeFile) {
                  const nextVal = event.target.value;
                  updateFiles(files.map((f) => (f.id === activeFile.id ? { ...f, content: nextVal } : f)));
                  syncCursor(event.currentTarget);
                }
              }}
              placeholder={
                activeFile?.language === "html"
                  ? "<!-- Nhập mã HTML tại đây -->"
                  : activeFile?.language === "css"
                    ? "/* Nhập mã CSS tại đây */"
                    : "// Nhập mã JavaScript tại đây"
              }
            />
          </div>
        </div>
      </div>

      {/* VS Code Bottom Status Bar */}
      <div className="vscode-statusbar">
        <div className="vscode-status-left">
          <span>📄 {activeFile?.name ?? "index.html"}</span>
          <span>· {files.length} files</span>
          {!readOnly && onRunShortcut && <span>· Ctrl+Enter Run · Ctrl+S Lưu</span>}
        </div>
        <div className="vscode-status-right">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>UTF-8</span>
          <span>{activeFile ? LANG_DISPLAY[activeFile.language] : "Text"}</span>
        </div>
      </div>
    </div>
  );
}
