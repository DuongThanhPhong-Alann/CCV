import type {
  CodeBehaviorStep,
  CodeBundle,
  CodeCriterion,
  CodeFile,
  CodeFileLanguage,
} from "@/lib/code-task-types";

export const EMPTY_CODE_BUNDLE: CodeBundle = {
  html: "",
  css: "",
  js: "",
  files: [
    { id: "file_html", name: "index.html", language: "html", content: "" },
    { id: "file_css", name: "style.css", language: "css", content: "" },
    { id: "file_js", name: "script.js", language: "js", content: "" },
  ],
};

export function createCriterionId() {
  return `crit_${Math.random().toString(36).slice(2, 10)}`;
}

export function createFileId() {
  return `file_${Math.random().toString(36).slice(2, 10)}`;
}

export function detectFileLanguage(fileName: string): CodeFileLanguage {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "js";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "md";
  return "txt";
}

export function normalizeCodeFiles(bundle?: Partial<CodeBundle> | null): CodeFile[] {
  if (bundle?.files && Array.isArray(bundle.files) && bundle.files.length > 0) {
    return bundle.files.map((file, idx) => ({
      id: typeof file.id === "string" && file.id.trim() ? file.id : `file_${idx}_${createFileId()}`,
      name: typeof file.name === "string" && file.name.trim() ? file.name.trim() : `file_${idx + 1}.txt`,
      language: file.language || detectFileLanguage(file.name || ""),
      content: typeof file.content === "string" ? file.content : "",
    }));
  }
  return [
    { id: "file_html", name: "index.html", language: "html", content: typeof bundle?.html === "string" ? bundle.html : "" },
    { id: "file_css", name: "style.css", language: "css", content: typeof bundle?.css === "string" ? bundle.css : "" },
    { id: "file_js", name: "script.js", language: "js", content: typeof bundle?.js === "string" ? bundle.js : "" },
  ];
}

export function filesToCodeBundle(files: CodeFile[]): CodeBundle {
  const htmlFiles = files.filter((f) => f.language === "html" || f.name.toLowerCase().endsWith(".html"));
  const cssFiles = files.filter((f) => f.language === "css" || f.name.toLowerCase().endsWith(".css"));
  const jsFiles = files.filter((f) => f.language === "js" || f.name.toLowerCase().endsWith(".js"));
  const mainHtml = htmlFiles.find((f) => f.name.toLowerCase() === "index.html") ?? htmlFiles[0];
  return {
    html: mainHtml?.content ?? "",
    css: cssFiles.map((f) => f.content).filter(Boolean).join("\n\n"),
    js: jsFiles.map((f) => f.content).filter(Boolean).join("\n\n"),
    files: files.map((f) => ({ ...f })),
  };
}

export function sanitizeCodeBundle(value: unknown): CodeBundle {
  if (!value || typeof value !== "object") return normalizeToBundle([]);
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.files) && record.files.length > 0) {
    const cleanFiles: CodeFile[] = [];
    for (let i = 0; i < Math.min(record.files.length, 30); i += 1) {
      const item = record.files[i];
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const rawName = typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : `file_${i + 1}.txt`;
      const name = rawName.replace(/[\\/:*?"<>|]/g, "_") || `file_${i + 1}.txt`;
      cleanFiles.push({
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 60) : `file_${i}_${createFileId()}`,
        name,
        language: detectFileLanguage(name),
        content: typeof raw.content === "string" ? raw.content : "",
      });
    }
    if (cleanFiles.length > 0) return filesToCodeBundle(cleanFiles);
  }
  const html = typeof record.html === "string" ? record.html : "";
  const css = typeof record.css === "string" ? record.css : "";
  const js = typeof record.js === "string" ? record.js : "";
  return filesToCodeBundle([
    { id: "file_html", name: "index.html", language: "html", content: html },
    { id: "file_css", name: "style.css", language: "css", content: css },
    { id: "file_js", name: "script.js", language: "js", content: js },
  ]);
}

function normalizeToBundle(files: CodeFile[]): CodeBundle {
  if (!files.length) return { ...EMPTY_CODE_BUNDLE, files: EMPTY_CODE_BUNDLE.files?.map((f) => ({ ...f })) };
  return filesToCodeBundle(files);
}

function sanitizeSteps(rawSteps: unknown): CodeBehaviorStep[] | undefined {
  if (!Array.isArray(rawSteps)) return undefined;
  const steps: CodeBehaviorStep[] = [];
  for (const item of rawSteps.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const step = item as Record<string, unknown>;
    const action = step.action;
    if (action === "set_value" && typeof step.target === "string" && typeof step.value === "string") {
      steps.push({ action: "set_value", target: step.target.slice(0, 150), value: step.value.slice(0, 500) });
    } else if (action === "select_option" && typeof step.target === "string" && typeof step.optionText === "string") {
      steps.push({ action: "select_option", target: step.target.slice(0, 150), optionText: step.optionText.slice(0, 200) });
    } else if (action === "click" && typeof step.target === "string") {
      steps.push({ action: "click", target: step.target.slice(0, 150) });
    } else if (action === "wait") {
      const ms = typeof step.ms === "number" ? Math.min(500, Math.max(0, step.ms)) : 20;
      steps.push({ action: "wait", ms });
    } else if (action === "assert_text" && typeof step.pattern === "string") {
      steps.push({
        action: "assert_text",
        pattern: step.pattern.slice(0, 400),
        ...(step.regex ? { regex: true } : {}),
        ...(step.absent ? { absent: true } : {}),
        ...(typeof step.scope === "string" ? { scope: step.scope.slice(0, 120) } : {}),
      });
    } else if (action === "assert_count" && typeof step.selector === "string") {
      steps.push({
        action: "assert_count",
        selector: step.selector.slice(0, 120),
        ...(typeof step.min === "number" ? { min: step.min } : {}),
        ...(typeof step.max === "number" ? { max: step.max } : {}),
        ...(typeof step.exact === "number" ? { exact: step.exact } : {}),
      });
    } else if (action === "assert_row_contains" && typeof step.rowMatch === "string" && typeof step.expected === "string") {
      steps.push({
        action: "assert_row_contains",
        rowMatch: step.rowMatch.slice(0, 200),
        expected: step.expected.slice(0, 200),
      });
    } else if (
      action === "assert_style" &&
      typeof step.selector === "string" &&
      typeof step.expected === "string" &&
      (step.check === "color" || step.check === "bg" || step.check === "center" || step.check === "rounded")
    ) {
      steps.push({
        action: "assert_style",
        selector: step.selector.slice(0, 120),
        check: step.check,
        expected: step.expected.slice(0, 120),
      });
    }
  }
  return steps.length ? steps : undefined;
}

export function sanitizeCriteria(value: unknown): CodeCriterion[] {
  if (!Array.isArray(value)) return [];
  const allowedTypes = new Set([
    "text_contains",
    "element_exists",
    "element_text",
    "style_color",
    "style_align",
    "style_property",
    "attribute_check",
    "behavior_test",
    "console_contains",
    "js_analysis",
  ]);
  const criteria: CodeCriterion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const type = typeof raw.type === "string" && allowedTypes.has(raw.type)
      ? (raw.type as CodeCriterion["type"])
      : "text_contains";
    const label = typeof raw.label === "string" ? raw.label.trim().slice(0, 220) : "";
    const selector = typeof raw.selector === "string" && raw.selector.trim() ? raw.selector.trim().slice(0, 140) : "*";
    const expected = typeof raw.expected === "string" ? raw.expected.trim().slice(0, 500) : "";
    const property = typeof raw.property === "string" && raw.property.trim() ? raw.property.trim().slice(0, 60) : undefined;
    const attribute = typeof raw.attribute === "string" && raw.attribute.trim() ? raw.attribute.trim().slice(0, 60) : undefined;
    const minCount = typeof raw.minCount === "number" && Number.isFinite(raw.minCount) && raw.minCount >= 1 ? Math.floor(raw.minCount) : undefined;
    const weight = typeof raw.weight === "number" && Number.isFinite(raw.weight) && raw.weight > 0 ? Math.min(100, raw.weight) : 1;
    const steps = type === "behavior_test" ? sanitizeSteps(raw.steps) : undefined;
    if (!label && !expected && type !== "element_exists" && type !== "behavior_test") continue;
    criteria.push({
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 60) : createCriterionId(),
      type,
      label: label || expected || `Kiểm tra ${selector}`,
      selector,
      ...(property ? { property } : {}),
      ...(attribute ? { attribute } : {}),
      expected,
      ...(minCount ? { minCount } : {}),
      weight,
      ...(steps ? { steps } : {}),
    });
  }
  return criteria.slice(0, 60);
}

export const CRITERION_TYPE_LABELS: Record<CodeCriterion["type"], string> = {
  text_contains: "Nội dung chữ trên trang",
  element_exists: "Thẻ / Phần tử HTML",
  element_text: "Chữ trong thẻ cụ thể",
  style_color: "Màu sắc (Chữ / Nền / Viền)",
  style_align: "Căn chỉnh & Bố cục",
  style_property: "Thuộc tính CSS khác",
  attribute_check: "Thuộc tính thẻ HTML",
  behavior_test: "Kiểm thử tương tác JS",
  console_contains: "Kết quả Console (console.log)",
  js_analysis: "Cú pháp & Kiểu dữ liệu JS",
};

type RunnerPayload = {
  runId: string;
  mode: "grade" | "analyze" | "preview";
  criteria: CodeCriterion[];
  passThreshold: number;
  rawJs?: string;
};

function safeJsonForScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function compileBundleHtmlParts(code: CodeBundle) {
  const files = normalizeCodeFiles(code);
  const htmlFiles = files.filter((f) => f.language === "html");
  const cssFiles = files.filter((f) => f.language === "css");
  const jsFiles = files.filter((f) => f.language === "js");

  const mainHtml = htmlFiles.find((f) => f.name.toLowerCase() === "index.html") ?? htmlFiles[0];
  let htmlSource = mainHtml?.content ?? code.html ?? "";

  // Remove local relative <link rel="stylesheet" href="..."> and <script src="..."></script>
  // that refer to local workspace files so srcDoc never triggers broken relative requests.
  htmlSource = htmlSource.replace(
    /<link\b[^>]*rel=["']?stylesheet["']?[^>]*href=["']?(?!https?:\/\/|data:)[^"'>\s]+["']?[^>]*>/gi,
    "",
  );
  htmlSource = htmlSource.replace(
    /<script\b[^>]*src=["']?(?!https?:\/\/|data:)[^"'>\s]+["']?[^>]*>\s*<\/script>/gi,
    "",
  );

  const combinedCss = cssFiles.map((f) => f.content).filter(Boolean).join("\n\n") || code.css || "";
  const combinedJs = jsFiles.map((f) => f.content).filter(Boolean).join("\n\n") || code.js || "";

  return { htmlSource, combinedCss, combinedJs };
}

/**
 * Builds an isolated HTML srcDoc combining all HTML/CSS/JS workspace files,
 * console/error hooks in <head>, and either preview-only reporting, criteria
 * extraction ("analyze"), or full DOM + interactive behavioral grading ("grade").
 */
export function buildRunnerHtml({
  code,
  criteria,
  runId,
  mode,
  passThreshold = 100,
}: {
  code: CodeBundle;
  criteria: CodeCriterion[];
  runId: string;
  mode: "grade" | "analyze" | "preview";
  passThreshold?: number;
}) {
  const { htmlSource, combinedCss, combinedJs } = compileBundleHtmlParts(code);

  const payload: RunnerPayload = {
    runId,
    mode,
    criteria,
    passThreshold,
    rawJs: combinedJs,
  };

  const headConsoleHook = `<script>
(function(){
  window.__CCV_LOGS__ = [];
  window.__CCV_ERRORS__ = [];
  function fmt(a){
    if(a===null) return "null";
    if(a===undefined) return "undefined";
    if(typeof a==="string") return a;
    try{ return JSON.stringify(a); }catch(e){ return String(a); }
  }
  ["log","info","warn","error"].forEach(function(lv){
    var orig = console[lv];
    console[lv] = function(){
      var msg = Array.prototype.slice.call(arguments).map(fmt).join(" ");
      if(lv==="error") window.__CCV_ERRORS__.push(msg);
      else window.__CCV_LOGS__.push((lv==="warn"?"[warn] ":"")+msg);
      if(orig && orig.apply) orig.apply(console, arguments);
    };
  });
  window.alert = function(m){ window.__CCV_LOGS__.push("[alert] "+String(m)); };
  window.confirm = function(m){ window.__CCV_LOGS__.push("[confirm] "+String(m)); return true; };
  window.prompt = function(m,d){ window.__CCV_LOGS__.push("[prompt] "+String(m)); return d||""; };
  window.addEventListener("error", function(ev){
    window.__CCV_ERRORS__.push(ev.message || "Lỗi JavaScript");
  });
  window.addEventListener("unhandledrejection", function(ev){
    window.__CCV_ERRORS__.push(ev.reason ? String(ev.reason) : "Promise bị từ chối");
  });
})();
</script>`;

  const bridgeScript = `
<script>
(function() {
  var PAYLOAD = ${safeJsonForScript(payload)};
  var consoleLogs = window.__CCV_LOGS__ || [];
  var errors = window.__CCV_ERRORS__ || [];

  function normText(str) {
    return String(str || "").replace(/\\s+/g, " ").trim().toLowerCase();
  }

  function parseRgba(cssColor) {
    if (!cssColor) return null;
    var raw = String(cssColor).split("|")[0].trim();
    var probe = document.createElement("span");
    probe.style.display = "none";
    probe.style.color = "";
    probe.style.color = raw;
    if (!probe.style.color) return null;
    (document.body || document.documentElement).appendChild(probe);
    var computed = getComputedStyle(probe).color;
    probe.remove();
    var m = computed.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*,\\s*([\\d.]+))?\\s*\\)/i);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
  }

  function rgbaToHex(rgba) {
    if (!rgba) return "";
    function hex(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); }
    return "#" + hex(rgba[0]) + hex(rgba[1]) + hex(rgba[2]);
  }

  function rawCssToRgba(computed) {
    if (!computed) return null;
    var m = String(computed).match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*,\\s*([\\d.]+))?\\s*\\)/i);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
  }

  function matchColorFamily(rgba, family) {
    if (family === "default") {
      return !rgba || rgba[3] === 0 || (rgba[0] >= 240 && rgba[1] >= 240 && rgba[2] >= 240);
    }
    if (!rgba || rgba[3] === 0) return false;
    var r = rgba[0], g = rgba[1], b = rgba[2];
    if (family === "white") return r >= 242 && g >= 242 && b >= 242;
    if (family === "red") return r >= 150 && r > g + 25 && r > b + 25;
    if (family === "yellow") return r >= 200 && g >= 170 && Math.min(r, g) - b >= 25;
    if (family === "light-blue") return b > r + 8 && b >= 190 && g >= 180 && r >= 130;
    if (family === "light-gray") {
      var diff = Math.max(r, g, b) - Math.min(r, g, b);
      return r >= 215 && g >= 215 && b >= 215 && diff <= 28 && !(r >= 253 && g >= 253 && b >= 253);
    }
    if (family === "light-purple") return b >= 200 && r >= 185 && g < b - 6 && r >= g;
    if (family === "blue") return b > r + 30 && b >= 130;
    if (family === "purple") return b >= 120 && r >= 85 && g < Math.min(r, b) - 15;
    if (family === "green") return g > r + 20 && g > b + 10 && g >= 100;
    return false;
  }

  function colorMatchesExpected(actualRgba, expectedSpec) {
    var parts = String(expectedSpec || "").split("|");
    var primary = parts[0] ? parts[0].trim() : "";
    var families = [];
    for (var i = 0; i < parts.length; i++) {
      var pt = parts[i].trim();
      if (pt.indexOf("family:") === 0) families.push(pt.slice(7).trim());
    }
    if (families.indexOf("default") !== -1 && matchColorFamily(actualRgba, "default")) return true;
    if (!actualRgba) return false;
    var expectedRgba = primary && primary.indexOf("family:") !== 0 ? parseRgba(primary) : null;
    if (expectedRgba && actualRgba[3] > 0) {
      var close = Math.abs(actualRgba[0] - expectedRgba[0]) <= 6 &&
                  Math.abs(actualRgba[1] - expectedRgba[1]) <= 6 &&
                  Math.abs(actualRgba[2] - expectedRgba[2]) <= 6;
      if (close) return true;
    }
    for (var fi = 0; fi < families.length; fi++) {
      if (matchColorFamily(actualRgba, families[fi])) return true;
    }
    return false;
  }

  function queryElements(selector) {
    try {
      var list = Array.prototype.slice.call(document.querySelectorAll(selector || "*"));
      return list.filter(function(el) {
        var tag = el.tagName ? el.tagName.toUpperCase() : "";
        return tag !== "SCRIPT" && tag !== "STYLE" && tag !== "HEAD" && tag !== "META" && tag !== "LINK" && tag !== "TITLE";
      });
    } catch (e) {
      return [];
    }
  }

  function isElementCentered(el) {
    var cs = getComputedStyle(el);
    if (cs.textAlign === "center" || cs.textAlign === "-webkit-center") return { ok: true, how: "text-align: center" };
    if (cs.display && cs.display.indexOf("flex") !== -1 && (cs.justifyContent === "center" || cs.alignItems === "center")) {
      return { ok: true, how: "flex (" + cs.justifyContent + " / " + cs.alignItems + ")" };
    }
    if (cs.display && cs.display.indexOf("grid") !== -1 && (cs.justifyContent === "center" || cs.placeItems === "center" || cs.justifyItems === "center")) {
      return { ok: true, how: "grid center" };
    }
    var parent = el.parentElement;
    if (parent && el.tagName !== "BODY" && el.tagName !== "HTML") {
      var er = el.getBoundingClientRect();
      var pr = parent.getBoundingClientRect();
      if (er.width > 0 && pr.width - er.width > 20) {
        var leftGap = er.left - pr.left;
        var rightGap = pr.right - er.right;
        if (Math.abs(leftGap - rightGap) <= 12 && leftGap > 4) {
          return { ok: true, how: "căn giữa theo khối (margin auto / layout)" };
        }
      }
    }
    return { ok: false, how: "text-align: " + cs.textAlign + ", display: " + cs.display };
  }

  function getAssociatedLabelText(inputEl) {
    var parts = [];
    if (inputEl.placeholder) parts.push(inputEl.placeholder);
    if (inputEl.getAttribute("aria-label")) parts.push(inputEl.getAttribute("aria-label"));
    if (inputEl.name) parts.push(inputEl.name);
    if (inputEl.id) {
      parts.push(inputEl.id);
      var lbl = document.querySelector('label[for="' + inputEl.id.replace(/"/g, '\\\\"') + '"]');
      if (lbl) parts.push(lbl.innerText || lbl.textContent || "");
    }
    var parentLabel = inputEl.closest ? inputEl.closest("label") : null;
    if (parentLabel) parts.push(parentLabel.innerText || parentLabel.textContent || "");
    return normText(parts.join(" "));
  }

  function locateElement(target) {
    var spec = String(target || "");
    if (spec.indexOf("css:") === 0) {
      return document.querySelector(spec.slice(4));
    }

    if (spec.indexOf("card-button:") === 0) {
      var parts = spec.slice(12).split("|");
      var cardText = normText(parts[0]);
      var btnTerms = parts.slice(1).map(normText).filter(Boolean);
      var btns = queryElements('button, input[type="button"], input[type="submit"], [role="button"]');
      var bestBtn = null;
      var bestLen = Infinity;
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var bt = normText(b.innerText || b.textContent || b.value || "");
        var btnOk = btnTerms.length === 0 || btnTerms.some(function(term) { return bt.indexOf(term) !== -1; });
        if (!btnOk) continue;
        var cur = b.parentElement;
        for (var depth = 0; depth < 4 && cur && cur.tagName !== "BODY"; depth++) {
          var ct = normText(cur.innerText || cur.textContent || "");
          if (ct.indexOf(cardText) !== -1 && ct.length < bestLen) {
            bestLen = ct.length;
            bestBtn = b;
            break;
          }
          cur = cur.parentElement;
        }
      }
      return bestBtn;
    }

    if (spec.indexOf("row-button:") === 0) {
      var rParts = spec.slice(11).split("|");
      var rowMatch = normText(rParts[0]);
      var rBtnTerms = rParts.slice(1).map(normText).filter(Boolean);
      var rows = queryElements("tr, li, .row, .item, .student-item, .todo-item, .task-item, .card");
      for (var r = 0; r < rows.length; r++) {
        var rt = normText(rows[r].innerText || rows[r].textContent || "");
        if (rt.indexOf(rowMatch) === -1) continue;
        var rBtns = rows[r].querySelectorAll('button, input[type="button"], [role="button"]');
        for (var rb = 0; rb < rBtns.length; rb++) {
          var rbt = normText(rBtns[rb].innerText || rBtns[rb].textContent || rBtns[rb].value || "");
          if (rBtnTerms.length === 0 || rBtnTerms.some(function(t) { return rbt.indexOf(t) !== -1; })) {
            return rBtns[rb];
          }
        }
      }
      return null;
    }

    if (spec.indexOf("button:") === 0) {
      var bTerms = spec.slice(7).split("|").map(normText).filter(Boolean);
      var allBtns = queryElements('button, input[type="button"], input[type="submit"], [role="button"]');
      for (var bi = 0; bi < allBtns.length; bi++) {
        var btxt = normText(allBtns[bi].innerText || allBtns[bi].textContent || allBtns[bi].value || "");
        if (bTerms.some(function(t) { return btxt === t; })) return allBtns[bi];
      }
      for (var bj = 0; bj < allBtns.length; bj++) {
        var btxt2 = normText(allBtns[bj].innerText || allBtns[bj].textContent || allBtns[bj].value || "");
        if (bTerms.some(function(t) { return btxt2.indexOf(t) !== -1; })) return allBtns[bj];
      }
      return null;
    }

    if (spec.indexOf("input:") === 0) {
      var iTerms = spec.slice(6).split("|");
      var inputs = queryElements("input, textarea").filter(function(el) {
        var tp = (el.type || "").toLowerCase();
        return tp !== "button" && tp !== "submit" && tp !== "reset" && tp !== "hidden" && tp !== "checkbox" && tp !== "radio";
      });
      var fallbackIdx = -1;
      var textTerms = [];
      for (var it = 0; it < iTerms.length; it++) {
        var rawTerm = iTerms[it].trim();
        if (rawTerm.indexOf("#") === 0) {
          fallbackIdx = Number(rawTerm.slice(1));
        } else if (rawTerm) {
          textTerms.push(normText(rawTerm));
        }
      }
      for (var ii = 0; ii < inputs.length; ii++) {
        var meta = getAssociatedLabelText(inputs[ii]);
        if (textTerms.some(function(t) { return meta.indexOf(t) !== -1; })) return inputs[ii];
      }
      if (fallbackIdx >= 0 && fallbackIdx < inputs.length) return inputs[fallbackIdx];
      return null;
    }

    if (spec.indexOf("select:") === 0) {
      var sTerms = spec.slice(7).split("|");
      var selects = queryElements("select");
      var sFallback = 0;
      var sTextTerms = [];
      for (var st = 0; st < sTerms.length; st++) {
        var rSt = sTerms[st].trim();
        if (rSt.indexOf("#") === 0) sFallback = Number(rSt.slice(1));
        else if (rSt) sTextTerms.push(normText(rSt));
      }
      for (var si = 0; si < selects.length; si++) {
        var smeta = getAssociatedLabelText(selects[si]);
        if (sTextTerms.some(function(t) { return smeta.indexOf(t) !== -1; })) return selects[si];
      }
      return selects[sFallback] || selects[0] || null;
    }

    return queryElements(spec)[0] || null;
  }

  function setNativeValue(el, val) {
    var proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, val);
    else el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function selectOptionMatch(selectEl, optionText) {
    var targetNorm = normText(optionText);
    var opts = selectEl.options || [];
    for (var i = 0; i < opts.length; i++) {
      var oText = normText(opts[i].textContent || "");
      var oVal = normText(opts[i].value || "");
      if (oText === targetNorm || oVal === targetNorm || oText.indexOf(targetNorm) !== -1 || oVal.indexOf(targetNorm) !== -1) {
        selectEl.selectedIndex = i;
        selectEl.value = opts[i].value;
        selectEl.dispatchEvent(new Event("input", { bubbles: true }));
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function checkColorCriterion(selector, property, expected) {
    var prop = property || "color";
    var colorEls = queryElements(selector);
    if (selector === "body" && document.documentElement && prop === "backgroundColor") {
      colorEls.push(document.documentElement);
    }
    var firstColorHex = "";
    for (var k = 0; k < colorEls.length; k++) {
      var targetEl = colorEls[k];
      var prevTr = targetEl.style ? targetEl.style.transition : "";
      if (targetEl.style) {
        targetEl.style.transition = "none";
        void targetEl.offsetWidth;
      }
      var elColor = getComputedStyle(targetEl)[prop];
      if (targetEl.style) targetEl.style.transition = prevTr;
      var actualRgba = rawCssToRgba(elColor);
      if (actualRgba && actualRgba[3] > 0 && !firstColorHex) {
        firstColorHex = rgbaToHex(actualRgba);
      }
      if (colorMatchesExpected(actualRgba, expected)) {
        return { passed: true, actual: "Khớp màu " + (actualRgba && actualRgba[3] > 0 ? rgbaToHex(actualRgba) : "mặc định") };
      }
    }
    return {
      passed: false,
      actual: colorEls.length === 0
        ? "Không tìm thấy phần tử \\"" + selector + "\\""
        : (firstColorHex ? "Màu hiện tại: " + firstColorHex : "Chưa đặt màu (trong suốt / mặc định)")
    };
  }

  function checkAlignCriterion(selector, expected) {
    var alignEls = queryElements(selector || "*");
    var expAlign = normText(expected || "center");
    var sampleInfo = "";
    for (var m = 0; m < alignEls.length; m++) {
      var el = alignEls[m];
      var cs = getComputedStyle(el);
      if (expAlign === "center" || expAlign === "flex-center" || expAlign === "grid-center") {
        var chk = isElementCentered(el);
        if (!sampleInfo) sampleInfo = chk.how;
        if (expAlign === "flex-center") {
          if (cs.display.indexOf("flex") !== -1 && cs.justifyContent === "center") return { passed: true, actual: "flex justify-content: center" };
        } else if (expAlign === "grid-center") {
          if (cs.display.indexOf("grid") !== -1 && (cs.justifyContent === "center" || cs.placeItems.indexOf("center") !== -1)) return { passed: true, actual: "grid center" };
        } else if (chk.ok) {
          return { passed: true, actual: chk.how };
        }
      } else {
        if (!sampleInfo) sampleInfo = cs.textAlign;
        if (cs.textAlign === expAlign || (expAlign === "right" && cs.justifyContent === "flex-end") || (expAlign === "left" && cs.justifyContent === "flex-start")) {
          return { passed: true, actual: "text-align: " + cs.textAlign };
        }
      }
    }
    return {
      passed: false,
      actual: alignEls.length === 0 ? "Không có phần tử \\"" + selector + "\\"" : ("Hiện tại: " + (sampleInfo || "chưa căn chỉnh đúng"))
    };
  }

  function runBehaviorSteps(steps) {
    if (!steps || !steps.length) return { passed: false, actual: "Chưa có kịch bản kiểm thử" };
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (s.action === "set_value") {
        var inp = locateElement(s.target);
        if (!inp) return { passed: false, actual: "Không tìm thấy ô nhập (" + s.target + ")" };
        setNativeValue(inp, s.value);
      } else if (s.action === "select_option") {
        var sel = locateElement(s.target);
        var optChosen = false;
        if (sel && sel.tagName === "SELECT") {
          optChosen = selectOptionMatch(sel, s.optionText);
        }
        if (!optChosen) {
          var optNorm = normText(s.optionText);
          var radios = queryElements('input[type="radio"]');
          for (var ri2 = 0; ri2 < radios.length; ri2++) {
            var rmeta = getAssociatedLabelText(radios[ri2]) + " " + normText(radios[ri2].value || "");
            if (rmeta.indexOf(optNorm) !== -1) {
              radios[ri2].checked = true;
              radios[ri2].click();
              radios[ri2].dispatchEvent(new Event("change", { bubbles: true }));
              optChosen = true;
              break;
            }
          }
        }
        if (!optChosen) {
          return { passed: false, actual: "Không tìm thấy lựa chọn \\"" + s.optionText + "\\"" };
        }
      } else if (s.action === "click") {
        var btn = locateElement(s.target);
        if (!btn) return { passed: false, actual: "Không tìm thấy nút \\"" + s.target + "\\"" };
        btn.click();
      } else if (s.action === "assert_text") {
        var scopeEl = s.scope ? locateElement(s.scope) : document.body;
        var scopeText = "";
        if (scopeEl) {
          scopeText = scopeEl.tagName === "SELECT"
            ? (scopeEl.textContent || "")
            : (scopeEl.innerText || scopeEl.textContent || "");
        }
        var textRaw = scopeText + (s.scope ? "" : (" " + consoleLogs.join(" ")));
        var matched = false;
        if (s.regex) {
          try {
            var rx = new RegExp(s.pattern, "im");
            matched = rx.test(textRaw);
          } catch (e) {
            matched = normText(textRaw).indexOf(normText(s.pattern)) !== -1;
          }
        } else {
          matched = normText(textRaw).indexOf(normText(s.pattern)) !== -1;
        }
        if (s.absent) {
          if (matched) return { passed: false, actual: "Vẫn xuất hiện nội dung không mong muốn (\\"" + s.pattern + "\\")" };
        } else {
          if (!matched) {
            return { passed: false, actual: "Không thấy kết quả mong đợi (\\"" + s.pattern + "\\") sau thao tác" };
          }
        }
      } else if (s.action === "assert_count") {
        var els = queryElements(s.selector);
        if (typeof s.exact === "number" && els.length !== s.exact) {
          return { passed: false, actual: "Số lượng \\"" + s.selector + "\\" là " + els.length + " (cần " + s.exact + ")" };
        }
        if (typeof s.min === "number" && els.length < s.min) {
          return { passed: false, actual: "Số lượng \\"" + s.selector + "\\" là " + els.length + " (cần >= " + s.min + ")" };
        }
        if (typeof s.max === "number" && els.length > s.max) {
          return { passed: false, actual: "Số lượng \\"" + s.selector + "\\" là " + els.length + " (cần <= " + s.max + ")" };
        }
      } else if (s.action === "assert_row_contains") {
        var rowMatchNorm = normText(s.rowMatch);
        var expNorm = normText(s.expected);
        var rowEls = queryElements("tr, li");
        if (rowEls.length === 0) {
          rowEls = queryElements(".row, .student-item, .cart-item, .todo-item, .task-item");
        }
        var foundRow = false;
        var rowMatchedExpected = false;
        var sampleRowText = "";
        for (var r = 0; r < rowEls.length; r++) {
          var rt = normText(rowEls[r].innerText || rowEls[r].textContent || "");
          if (rt.indexOf(rowMatchNorm) !== -1) {
            foundRow = true;
            sampleRowText = (rowEls[r].innerText || "").replace(/\\s+/g, " ").trim().slice(0, 80);
            if (rt.indexOf(expNorm) !== -1) {
              rowMatchedExpected = true;
              break;
            }
          }
        }
        if (!foundRow) return { passed: false, actual: "Không tìm thấy dòng chứa \\"" + s.rowMatch + "\\"" };
        if (!rowMatchedExpected) return { passed: false, actual: "Dòng \\"" + s.rowMatch + "\\" chưa có \\"" + s.expected + "\\" (Hiện tại: " + sampleRowText + ")" };
      } else if (s.action === "assert_style") {
        if (s.check === "color" || s.check === "bg") {
          var cr = checkColorCriterion(s.selector, s.check === "bg" ? "backgroundColor" : "color", s.expected);
          if (!cr.passed) return cr;
        } else if (s.check === "center") {
          var ar = checkAlignCriterion(s.selector, "center");
          if (!ar.passed) return ar;
        }
      }
    }
    return { passed: true, actual: "Thao tác & kết quả đầu ra chính xác" };
  }

  function evaluateCriteria(criteria) {
    var results = [];
    var bodyTextRaw = document.body ? (document.body.innerText || document.body.textContent || "") : "";
    var bodyTextNorm = normText(bodyTextRaw);

    for (var i = 0; i < criteria.length; i++) {
      var c = criteria[i];
      var passed = false;
      var actual = "";
      var weight = typeof c.weight === "number" && c.weight > 0 ? c.weight : 1;

      if (c.type === "text_contains") {
        var targetNorm = normText(c.expected);
        passed = targetNorm.length > 0 && bodyTextNorm.indexOf(targetNorm) !== -1;
        actual = passed ? "Có hiển thị nội dung yêu cầu" : (bodyTextRaw.trim() ? "Chưa thấy \\"" + c.expected + "\\" trong kết quả" : "Trang chưa có nội dung chữ");
      } else if (c.type === "element_exists") {
        var els = queryElements(c.selector);
        var minCount = c.minCount && c.minCount > 0 ? c.minCount : 1;
        passed = els.length >= minCount;
        actual = "Tìm thấy " + els.length + " phần tử \\"" + c.selector + "\\"";
      } else if (c.type === "element_text") {
        var textEls = queryElements(c.selector);
        var expNorm = normText(c.expected);
        var foundText = "";
        for (var j = 0; j < textEls.length; j++) {
          var t = textEls[j].innerText || textEls[j].textContent || "";
          if (!foundText && t.trim()) foundText = t.trim().slice(0, 80);
          if (normText(t).indexOf(expNorm) !== -1) {
            passed = true;
            actual = "Tìm thấy \\"" + t.trim().slice(0, 80) + "\\"";
            break;
          }
        }
        if (!passed) {
          actual = textEls.length === 0 ? "Không có thẻ \\"" + c.selector + "\\"" : ("Nội dung hiện tại: \\"" + (foundText || "(trống)") + "\\"");
        }
      } else if (c.type === "style_color") {
        var colorRes = checkColorCriterion(c.selector, c.property || "color", c.expected);
        passed = colorRes.passed;
        actual = colorRes.actual;
      } else if (c.type === "style_align") {
        var alignRes = checkAlignCriterion(c.selector, c.expected || "center");
        passed = alignRes.passed;
        actual = alignRes.actual;
      } else if (c.type === "style_property") {
        var sProp = c.property || "fontWeight";
        var sEls = queryElements(c.selector);
        var expVal = normText(c.expected);
        var firstVal = "";
        for (var p = 0; p < sEls.length; p++) {
          var rawVal = String(getComputedStyle(sEls[p])[sProp] || "");
          var valNorm = normText(rawVal);
          if (!firstVal && rawVal) firstVal = rawVal;
          if (sProp === "fontWeight" && (expVal === "bold" || expVal === "700" || expVal === "600")) {
            var numW = Number(valNorm);
            if (valNorm === "bold" || (!isNaN(numW) && numW >= 600)) { passed = true; actual = rawVal; break; }
          } else if (sProp === "borderRadius" && (expVal === ">0" || expVal === "rounded")) {
            if (parseFloat(rawVal) > 0) { passed = true; actual = rawVal; break; }
          } else if (sProp === "display" && expVal === "flex") {
            if (valNorm === "flex" || valNorm === "inline-flex") { passed = true; actual = rawVal; break; }
          } else if (valNorm === expVal || valNorm.indexOf(expVal) !== -1) {
            passed = true;
            actual = rawVal;
            break;
          }
        }
        if (!passed) {
          actual = sEls.length === 0 ? "Không tìm thấy \\"" + c.selector + "\\"" : ("Hiện tại: " + (firstVal || "trống"));
        }
      } else if (c.type === "attribute_check") {
        var attrName = c.attribute || "href";
        var aEls = queryElements(c.selector);
        var aExp = normText(c.expected);
        var foundAttr = "";
        for (var q = 0; q < aEls.length; q++) {
          var av = aEls[q].getAttribute(attrName);
          if (av !== null && av.trim() !== "") {
            if (!foundAttr) foundAttr = av.trim();
            if (!aExp || normText(av).indexOf(aExp) !== -1) {
              passed = true;
              actual = attrName + "=\\"" + av.trim().slice(0, 60) + "\\"";
              break;
            }
          }
        }
        if (!passed) {
          actual = aEls.length === 0 ? "Không tìm thấy thẻ \\"" + c.selector + "\\"" : (foundAttr ? "Giá trị hiện tại: " + foundAttr : "Thiếu thuộc tính " + attrName);
        }
      } else if (c.type === "behavior_test") {
        var bRes = runBehaviorSteps(c.steps || []);
        passed = bRes.passed;
        actual = bRes.actual;
      } else if (c.type === "console_contains") {
        var consoleText = consoleLogs.join("\\n");
        if (c.property === "min_lines") {
          var nonEmptyLines = consoleText.split(/\\r?\\n/).filter(function(ln) { return ln.trim().length > 0; });
          var needLines = c.minCount && c.minCount > 0 ? c.minCount : 1;
          passed = nonEmptyLines.length >= needLines;
          actual = "Console đã in " + nonEmptyLines.length + " dòng (yêu cầu >= " + needLines + " dòng)";
        } else if (c.property === "min_matches") {
          var needMatches = c.minCount && c.minCount > 0 ? c.minCount : 1;
          var matchCount = 0;
          try {
            var mm = consoleText.match(new RegExp(String(c.expected || ""), "gim"));
            matchCount = mm ? mm.length : 0;
          } catch (e) {
            matchCount = 0;
          }
          passed = matchCount >= needMatches;
          actual = "Tìm thấy " + matchCount + " lần xuất hiện (yêu cầu >= " + needMatches + ")";
        } else {
          var expList = String(c.expected || "").split("&&").map(function(x) { return x.trim(); }).filter(Boolean);
          var missingPart = "";
          passed = expList.length > 0;
          for (var ci = 0; ci < expList.length; ci++) {
            var part = expList[ci];
            var partOk = false;
            if (c.property === "regex") {
              try {
                partOk = new RegExp(part, "im").test(consoleText);
              } catch (e) {
                partOk = normText(consoleText).indexOf(normText(part)) !== -1;
              }
            } else {
              partOk = normText(consoleText).indexOf(normText(part)) !== -1;
            }
            if (!partOk) {
              passed = false;
              missingPart = part;
              break;
            }
          }
          actual = passed
            ? "Console đã in đầy đủ thông tin yêu cầu"
            : (consoleLogs.length === 0
                ? "Console đang trống (hãy dùng console.log(...))"
                : ("Console thiếu: \\"" + missingPart + "\\""));
        }
      } else if (c.type === "js_analysis") {
        var rawCode = String(PAYLOAD.rawJs || "");
        var noComments = "";
        var skeleton = "";
        var inStr = "";
        var inLineComment = false;
        var inBlockComment = false;
        var btChar = String.fromCharCode(96);
        for (var ci2 = 0; ci2 < rawCode.length; ci2++) {
          var ch = rawCode.charAt(ci2);
          var nx = rawCode.charAt(ci2 + 1);
          if (inLineComment) {
            if (ch === "\\n") {
              inLineComment = false;
              noComments += "\\n";
              skeleton += "\\n";
            }
            continue;
          }
          if (inBlockComment) {
            if (ch === "*" && nx === "/") {
              inBlockComment = false;
              ci2 += 1;
              noComments += " ";
              skeleton += " ";
            }
            continue;
          }
          if (inStr) {
            noComments += ch;
            if (ch === "\\\\") {
              noComments += nx;
              ci2 += 1;
              continue;
            }
            if (ch === inStr) {
              inStr = "";
              skeleton += "__STR__";
            }
            continue;
          }
          if (ch === "/" && nx === "/") {
            inLineComment = true;
            ci2 += 1;
            continue;
          }
          if (ch === "/" && nx === "*") {
            inBlockComment = true;
            ci2 += 1;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === btChar) {
            inStr = ch;
            noComments += ch;
            continue;
          }
          noComments += ch;
          skeleton += ch;
        }
        var decls = [];
        var declRe = /\\b(const|let|var)\\b\\s+([^\\n;]+(?:,\\s*\\n[^\\n;]+)*)/g;
        var dm;
        while ((dm = declRe.exec(noComments)) !== null) {
          decls.push({ kind: dm[1], body: dm[2] });
        }
        var skelDecls = [];
        var skelRe = /\\b(const|let|var)\\b\\s+([^\\n;]+(?:,\\s*\\n[^\\n;]+)*)/g;
        var sm;
        while ((sm = skelRe.exec(skeleton)) !== null) {
          skelDecls.push({ kind: sm[1], body: sm[2] });
        }

        var checkKind = c.property || "min_variables";
        var minNeed = c.minCount && c.minCount > 0 ? c.minCount : 1;

        if (checkKind === "const_with_value" || checkKind === "let_with_value" || checkKind === "var_with_value") {
          var targetKw = checkKind.split("_")[0];
          var reqParts = String(c.expected || "").split("&&").map(function(x) { return x.trim(); }).filter(Boolean);
          var missingReq = "";
          passed = reqParts.length > 0;
          for (var rp = 0; rp < reqParts.length; rp++) {
            var reqNorm = normText(reqParts[rp]);
            var foundDecl = decls.some(function(d) {
              return d.kind === targetKw && normText(d.body).indexOf(reqNorm) !== -1;
            });
            if (!foundDecl) {
              passed = false;
              missingReq = reqParts[rp];
              break;
            }
          }
          actual = passed
            ? "Đã dùng " + targetKw + " khai báo đúng giá trị"
            : ("Chưa thấy dùng " + targetKw + " khai báo \\"" + missingReq + "\\"");
        } else if (checkKind === "all_keywords") {
          var hasVar = skelDecls.some(function(d) { return d.kind === "var"; });
          var hasLet = skelDecls.some(function(d) { return d.kind === "let"; });
          var hasConst = skelDecls.some(function(d) { return d.kind === "const"; });
          passed = hasVar && hasLet && hasConst;
          var missingKws = [];
          if (!hasVar) missingKws.push("var");
          if (!hasLet) missingKws.push("let");
          if (!hasConst) missingKws.push("const");
          actual = passed ? "Đã dùng đủ var, let, const" : ("Còn thiếu từ khóa: " + missingKws.join(", "));
        } else if (checkKind === "min_variables") {
          var varCount = 0;
          for (var vi = 0; vi < skelDecls.length; vi++) {
            var eqMatches = skelDecls[vi].body.match(/=/g);
            varCount += eqMatches ? eqMatches.length : 1;
          }
          passed = varCount >= minNeed;
          actual = "Đã khai báo " + varCount + " biến (yêu cầu >= " + minNeed + ")";
        } else if (checkKind === "has_boolean") {
          var boolCount = 0;
          for (var bi2 = 0; bi2 < skelDecls.length; bi2++) {
            var bm = skelDecls[bi2].body.match(/=\\s*(?:true|false)\\b/g);
            if (bm) boolCount += bm.length;
          }
          passed = boolCount >= minNeed;
          actual = "Tìm thấy " + boolCount + " biến Boolean (yêu cầu >= " + minNeed + ")";
        } else if (checkKind === "has_number") {
          var numCount = 0;
          for (var ni = 0; ni < skelDecls.length; ni++) {
            var nm = skelDecls[ni].body.match(/=\\s*-?\\d+(?:[._]\\d+)*\\b/g);
            if (nm) numCount += nm.length;
          }
          passed = numCount >= minNeed;
          actual = "Tìm thấy " + numCount + " biến Number (yêu cầu >= " + minNeed + ")";
        } else if (checkKind === "has_string") {
          var strCount = 0;
          for (var si2 = 0; si2 < skelDecls.length; si2++) {
            var strm = skelDecls[si2].body.match(/=\\s*__STR__/g);
            if (strm) strCount += strm.length;
          }
          passed = strCount >= minNeed;
          actual = "Tìm thấy " + strCount + " biến String (yêu cầu >= " + minNeed + ")";
        } else if (checkKind === "uses_typeof") {
          var tm = skeleton.match(/\\btypeof\\b/g);
          var tCount = tm ? tm.length : 0;
          passed = tCount >= minNeed;
          actual = "Đã dùng typeof " + tCount + " lần (yêu cầu >= " + minNeed + ")";
        } else if (checkKind === "no_advanced_syntax") {
          var forbidden = skeleton.match(/\\b(if|else|for|while|do|switch|function|class)\\b|=>|\\bdocument\\s*\\./);
          passed = !forbidden;
          actual = passed ? "Tuân thủ kiến thức cơ bản (không dùng if/vòng lặp/hàm/DOM)" : ("Đang dùng cú pháp chưa học: " + forbidden[0]);
        } else if (checkKind === "has_operators") {
          var hasSingleOp = function(op) {
            if (op === "++") return skeleton.indexOf("++") !== -1;
            if (op === "--") return skeleton.indexOf("--") !== -1;
            if (op === "**") return skeleton.indexOf("**") !== -1;
            if (op === "*") return skeleton.replace(/\\*\\*/g, " ").indexOf("*") !== -1;
            if (op === "/") return skeleton.indexOf("/") !== -1;
            if (op === "%") return skeleton.indexOf("%") !== -1;
            if (op === "+") return skeleton.replace(/\\+\\+/g, " ").indexOf("+") !== -1;
            if (op === "-") return skeleton.replace(/--/g, " ").indexOf("-") !== -1;
            if (op === "===") return skeleton.indexOf("===") !== -1;
            if (op === "!==") return skeleton.indexOf("!==") !== -1;
            if (op === "==") {
              return skeleton.replace(/===|!==|==/g, function(m) {
                return m === "==" ? "__OP_EQ2__" : " ";
              }).indexOf("__OP_EQ2__") !== -1;
            }
            if (op === "!=") {
              return skeleton.replace(/!==|!=/g, function(m) {
                return m === "!=" ? "__OP_NEQ__" : " ";
              }).indexOf("__OP_NEQ__") !== -1;
            }
            if (op === ">=") return skeleton.indexOf(">=") !== -1;
            if (op === "<=") return skeleton.indexOf("<=") !== -1;
            if (op === ">") return skeleton.replace(/>=|=>/g, " ").indexOf(">") !== -1;
            if (op === "<") return skeleton.replace(/<=/g, " ").indexOf("<") !== -1;
            if (op === "&&") return skeleton.indexOf("&&") !== -1;
            if (op === "||") return skeleton.indexOf("||") !== -1;
            if (op === "!") return skeleton.replace(/!==|!=/g, " ").indexOf("!") !== -1;
            return skeleton.indexOf(op) !== -1;
          };
          var opGroups = String(c.expected || "").split(",");
          var cleanGroups = [];
          for (var ogi = 0; ogi < opGroups.length; ogi++) {
            var grp = opGroups[ogi].replace(/\\s+/g, "");
            if (grp) cleanGroups.push(grp);
          }
          var needOpCount = c.minCount && c.minCount > 0 ? Math.min(c.minCount, cleanGroups.length) : cleanGroups.length;
          var matchedGroups = 0;
          var missingOps = [];
          for (var ogj = 0; ogj < cleanGroups.length; ogj++) {
            var alts = cleanGroups[ogj].replace(/\\|\\|/g, "__OR__").split("|");
            var grpHit = false;
            for (var ai = 0; ai < alts.length; ai++) {
              var opName = alts[ai].replace(/__OR__/g, "||");
              if (opName && hasSingleOp(opName)) {
                grpHit = true;
                break;
              }
            }
            if (grpHit) matchedGroups++;
            else missingOps.push(cleanGroups[ogj]);
          }
          passed = cleanGroups.length > 0 && matchedGroups >= needOpCount;
          actual = passed
            ? ("Đã sử dụng đủ toán tử yêu cầu (" + matchedGroups + "/" + cleanGroups.length + ")")
            : ("Thiếu toán tử: " + missingOps.join(", "));
        } else if (checkKind === "uses_if_else") {
          var condMode = String(c.expected || "if_else");
          var hasIf = /\\bif\\s*\\(/.test(skeleton);
          var hasElseIf = /\\belse\\s+if\\s*\\(/.test(skeleton);
          var hasStandaloneElse = /\\belse\\b/.test(skeleton.replace(/\\belse\\s+if\\b/g, " "));
          if (condMode === "else_if") {
            passed = hasIf && hasElseIf && hasStandaloneElse;
            actual = passed
              ? "Đã sử dụng đầy đủ if / else if / else"
              : ("Cần dùng đủ if, else if và else (" + (!hasIf ? "thiếu if" : !hasElseIf ? "thiếu else if" : "thiếu else") + ")");
          } else if (condMode === "if") {
            passed = hasIf;
            actual = passed ? "Đã sử dụng câu lệnh if" : "Chưa sử dụng câu lệnh if";
          } else {
            passed = hasIf && hasStandaloneElse;
            actual = passed ? "Đã sử dụng cấu trúc if / else" : (!hasIf ? "Thiếu if" : "Thiếu else");
          }
        } else if (checkKind === "uses_switch") {
          var hasSwitch = /\\bswitch\\s*\\(/.test(skeleton);
          var caseMatches = skeleton.match(/\\bcase\\b/g);
          var caseCount = caseMatches ? caseMatches.length : 0;
          var minCases = c.minCount && c.minCount > 0 ? c.minCount : 2;
          var needDefault = String(c.expected || "") === "with_default";
          var hasDefault = /\\bdefault\\s*:/.test(skeleton);
          passed = hasSwitch && caseCount >= minCases && (!needDefault || hasDefault);
          actual = passed
            ? ("Đã dùng switch với " + caseCount + " case" + (needDefault ? " và default" : ""))
            : (!hasSwitch
                ? "Chưa sử dụng câu lệnh switch"
                : caseCount < minCases
                  ? ("Số lượng case mới có " + caseCount + " (yêu cầu >= " + minCases + ")")
                  : "Thiếu nhánh default trong switch");
        } else if (checkKind === "no_loops_funcs_dom") {
          var forbiddenCond = skeleton.match(/\\b(for|while|do|function|class|Array)\\b|=>|\\bdocument\\s*\\./);
          passed = !forbiddenCond;
          actual = passed
            ? "Tuân thủ kiến thức buổi 01–04 (chưa dùng vòng lặp/mảng/hàm/DOM)"
            : ("Đang dùng cú pháp chưa học: " + forbiddenCond[0]);
        } else if (checkKind === "uses_loops") {
          var maskedLoop = skeleton;
          var doWhileCount = 0;
          var doRe = /\\bdo\\b/g;
          var dm;
          var doRanges = [];
          while ((dm = doRe.exec(skeleton)) !== null) {
            var lpos = dm.index + dm[0].length;
            while (lpos < skeleton.length && /\\s/.test(skeleton.charAt(lpos))) lpos++;
            if (skeleton.charAt(lpos) === "{") {
              var ldepth = 0;
              var endBrace = -1;
              for (var lk = lpos; lk < skeleton.length; lk++) {
                if (skeleton.charAt(lk) === "{") ldepth++;
                else if (skeleton.charAt(lk) === "}") {
                  ldepth--;
                  if (ldepth === 0) {
                    endBrace = lk;
                    break;
                  }
                }
              }
              if (endBrace !== -1) {
                var tailStr = skeleton.slice(endBrace + 1);
                var wm = tailStr.match(/^\\s*while\\s*\\(/);
                if (wm) {
                  doWhileCount++;
                  doRanges.push([endBrace + 1, endBrace + 1 + wm[0].length]);
                }
              }
            } else {
              var semi = skeleton.indexOf(";", lpos);
              if (semi !== -1 && semi - lpos < 160) {
                var unbTail = skeleton.slice(semi + 1);
                var uwm = unbTail.match(/^\\s*while\\s*\\(/);
                if (uwm) {
                  doWhileCount++;
                  doRanges.push([semi + 1, semi + 1 + uwm[0].length]);
                }
              }
            }
          }
          if (doRanges.length > 0) {
            var mchars = maskedLoop.split("");
            for (var ri = 0; ri < doRanges.length; ri++) {
              for (var rj = doRanges[ri][0]; rj < doRanges[ri][1]; rj++) mchars[rj] = " ";
            }
            maskedLoop = mchars.join("");
          }
          var forMatches = maskedLoop.match(/\\bfor\\s*\\(/g);
          var whileMatches = maskedLoop.match(/\\bwhile\\s*\\(/g);
          var loopCounts = {
            for: forMatches ? forMatches.length : 0,
            while: whileMatches ? whileMatches.length : 0,
            do_while: doWhileCount
          };
          var reqLoops = String(c.expected || "for").split(",").map(function(x) { return x.trim(); }).filter(Boolean);
          var needLoops = c.minCount && c.minCount > 0 ? Math.min(c.minCount, reqLoops.length) : reqLoops.length;
          var hitLoops = 0;
          var missingLoops = [];
          for (var li2 = 0; li2 < reqLoops.length; li2++) {
            var lName = reqLoops[li2];
            if ((loopCounts[lName] || 0) > 0) hitLoops++;
            else missingLoops.push(lName === "do_while" ? "do...while" : lName);
          }
          passed = reqLoops.length > 0 && hitLoops >= needLoops;
          actual = passed
            ? ("Đã dùng đủ vòng lặp yêu cầu (for: " + loopCounts.for + ", while: " + loopCounts.while + ", do...while: " + loopCounts.do_while + ")")
            : ("Thiếu vòng lặp: " + missingLoops.join(", "));
        } else if (checkKind === "no_arrays_funcs_dom") {
          var forbiddenLoop = skeleton.match(/\\b(function|class|Array)\\b|=>|\\bdocument\\s*\\./);
          var hasArrayBracket = skeleton.indexOf("[") !== -1;
          passed = !forbiddenLoop && !hasArrayBracket;
          actual = passed
            ? "Tuân thủ kiến thức buổi 01–05 (chưa dùng mảng/hàm/DOM)"
            : ("Đang dùng cú pháp chưa học: " + (forbiddenLoop ? forbiddenLoop[0] : "mảng [...]"));
        } else if (checkKind === "uses_functions") {
          var fnMatches = skeleton.match(/\\bfunction\\b|=>/g);
          var fnCount = fnMatches ? fnMatches.length : 0;
          var retMatches = skeleton.match(/\\breturn\\b/g);
          var retCount = retMatches ? retMatches.length : 0;
          var needFn = c.minCount && c.minCount > 0 ? c.minCount : 1;
          var needRet = String(c.expected || "").indexOf("return") !== -1;
          passed = fnCount >= needFn && (!needRet || retCount >= needFn);
          actual = passed
            ? ("Đã khai báo " + fnCount + " hàm và dùng return " + retCount + " lần")
            : (fnCount < needFn ? ("Số hàm mới có " + fnCount + " (yêu cầu >= " + needFn + ")") : ("Thiếu câu lệnh return (" + retCount + "/" + needFn + ")"));
        } else if (checkKind === "uses_array_methods") {
          var hasArr = skeleton.indexOf("[") !== -1 || /\\bnew\\s+Array\\b/.test(skeleton);
          var reqMethods = String(c.expected || "").split(",").map(function(x) { return x.trim(); }).filter(Boolean);
          var needMethodCount = c.minCount && c.minCount > 0 ? Math.min(c.minCount, reqMethods.length) : reqMethods.length;
          var hitMethods = 0;
          var missingMethods = [];
          for (var mi = 0; mi < reqMethods.length; mi++) {
            var mName = reqMethods[mi];
            var mRx = new RegExp("\\\\." + mName + "\\\\s*\\\\(");
            if (mRx.test(skeleton)) hitMethods++;
            else missingMethods.push(mName + "()");
          }
          passed = hasArr && (reqMethods.length === 0 || hitMethods >= needMethodCount);
          actual = passed
            ? ("Đã dùng mảng và các phương thức yêu cầu (" + hitMethods + "/" + (reqMethods.length || 0) + ")")
            : (!hasArr ? "Chưa khai báo mảng [...]" : ("Thiếu phương thức mảng: " + missingMethods.join(", ")));
        } else if (checkKind === "uses_object") {
          var skNoCase = skeleton.replace(/\\b(case\\b[^:]*:|default\\s*:)/g, " ");
          var hasObjProp = /[a-zA-Z_$][\\w$]*\\s*:/.test(skNoCase) || /\\bnew\\s+Object\\b/.test(skeleton);
          var reqObj = String(c.expected || "");
          var needThis = reqObj.indexOf("this") !== -1;
          var needDelete = reqObj.indexOf("delete") !== -1;
          var needMethods = reqObj.indexOf("methods") !== -1;
          var hasThis = /\\bthis\\s*\\./.test(skeleton);
          var hasDelete = /\\bdelete\\s+/.test(skeleton);
          var rawMeths = skeleton.match(/\\bfunction\\s*\\(|[a-zA-Z_$][\\w$]*\\s*:\\s*function\\b|[a-zA-Z_$][\\w$]*\\s*\\([^)]*\\)\\s*\\{/g) || [];
          var objMethCount = 0;
          for (var omi = 0; omi < rawMeths.length; omi++) {
            if (!/^(?:if|for|while|switch|catch)\\b/.test(rawMeths[omi])) objMethCount++;
          }
          var minMeth = c.minCount && c.minCount > 0 ? c.minCount : 1;
          var okMethods = !needMethods || objMethCount >= minMeth;
          passed = hasObjProp && (!needThis || hasThis) && (!needDelete || hasDelete) && okMethods;
          actual = passed
            ? "Đã khai báo Object và sử dụng đúng cú pháp yêu cầu"
            : (!hasObjProp ? "Chưa khai báo Object { ... }" : (!okMethods ? "Chưa đủ phương thức trong Object" : (needThis && !hasThis ? "Chưa dùng từ khóa this." : "Chưa dùng delete để xóa thuộc tính")));
        } else if (checkKind === "no_dom") {
          var domHit = skeleton.match(/\\bdocument\\s*\\.|\\bwindow\\s*\\./);
          passed = !domHit;
          actual = passed ? "Thực thi logic thuần JavaScript trên Console (chưa dùng DOM)" : ("Chưa cần dùng DOM (" + domHit[0] + ")");
        }
      }

      results.push({
        criterionId: c.id,
        label: c.label,
        type: c.type,
        passed: passed,
        expected: c.expected || (c.minCount ? ">= " + c.minCount + " " + c.selector : c.selector),
        actual: actual,
        weight: weight
      });
    }

    var totalPoints = 0;
    var earnedPoints = 0;
    var passedCount = 0;
    for (var r = 0; r < results.length; r++) {
      totalPoints += results[r].weight;
      if (results[r].passed) {
        earnedPoints += results[r].weight;
        passedCount += 1;
      }
    }
    var percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100;
    var threshold = typeof PAYLOAD.passThreshold === "number" ? PAYLOAD.passThreshold : 100;

    return {
      percentage: percentage,
      earnedPoints: Math.round(earnedPoints * 10) / 10,
      totalPoints: Math.round(totalPoints * 10) / 10,
      passed: percentage >= threshold,
      passedCount: passedCount,
      totalCount: results.length,
      passThreshold: threshold,
      results: results,
      consoleLogs: consoleLogs.slice(0, 50),
      errors: errors.slice(0, 30),
      evaluatedAt: new Date().toISOString()
    };
  }

  function extractCriteriaFromDocument() {
    var extracted = [];
    var seenTexts = {};
    var seenColors = {};
    var idx = 0;
    function nextId() { idx += 1; return "auto_" + idx + "_" + Math.random().toString(36).slice(2, 6); }

    var textTags = ["H1", "H2", "H3", "H4", "P", "LI", "TH", "TD", "BUTTON", "A", "SPAN", "STRONG", "LABEL"];
    var allEls = queryElements("*");
    for (var i = 0; i < allEls.length; i++) {
      var el = allEls[i];
      if (!el.tagName) continue;
      var tag = el.tagName.toUpperCase();
      var hasBlockChild = false;
      for (var ch = 0; ch < el.children.length; ch++) {
        var ctag = el.children[ch].tagName ? el.children[ch].tagName.toUpperCase() : "";
        if (ctag !== "SPAN" && ctag !== "STRONG" && ctag !== "B" && ctag !== "I" && ctag !== "EM" && ctag !== "CODE") {
          hasBlockChild = true;
          break;
        }
      }
      if (hasBlockChild && tag !== "H1" && tag !== "H2" && tag !== "H3") continue;
      var txt = (el.innerText || "").replace(/\\s+/g, " ").trim();
      if (!txt || txt.length < 2 || txt.length > 100) continue;
      var key = txt.toLowerCase();
      if (seenTexts[key]) continue;
      if (textTags.indexOf(tag) !== -1 || el.children.length === 0) {
        seenTexts[key] = true;
        extracted.push({
          id: nextId(),
          type: "text_contains",
          label: "Hiển thị nội dung: \\"" + txt + "\\"",
          selector: "*",
          expected: txt,
          weight: 10
        });
      }
      if (extracted.length >= 6) break;
    }

    var semanticTags = ["h1", "table", "img", "a", "ul", "button", "select", "input"];
    var addedTags = 0;
    for (var s = 0; s < semanticTags.length; s++) {
      var st = semanticTags[s];
      var matches = queryElements(st);
      if (matches.length > 0 && addedTags < 4) {
        addedTags += 1;
        extracted.push({
          id: nextId(),
          type: "element_exists",
          label: "Có ít nhất " + matches.length + " thẻ <" + st + ">",
          selector: st,
          expected: st,
          minCount: matches.length,
          weight: 10
        });
      }
    }

    if (document.body) {
      var bodyBg = rawCssToRgba(getComputedStyle(document.body).backgroundColor);
      if (bodyBg && bodyBg[3] > 0) {
        var bodyHex = rgbaToHex(bodyBg);
        if (bodyHex !== "#ffffff") {
          seenColors["body_bg_" + bodyHex] = true;
          extracted.push({
            id: nextId(),
            type: "style_color",
            label: "Màu nền trang (body) là " + bodyHex,
            selector: "body",
            property: "backgroundColor",
            expected: bodyHex,
            weight: 10
          });
        }
      }
    }

    var colorCandidates = queryElements("h1, h2, h3, p, button, a, div, section, article, main, th, header");
    var colorCount = 0;
    for (var cIdx = 0; cIdx < colorCandidates.length && colorCount < 3; cIdx++) {
      var cel = colorCandidates[cIdx];
      var ctagName = cel.tagName.toLowerCase();
      var ccs = getComputedStyle(cel);
      var txtColor = rawCssToRgba(ccs.color);
      if (txtColor && txtColor[3] > 0) {
        var hexC = rgbaToHex(txtColor);
        if (hexC !== "#000000" && !seenColors["fg_" + ctagName + "_" + hexC]) {
          seenColors["fg_" + ctagName + "_" + hexC] = true;
          var fgSelector = (ctagName === "div" || ctagName === "section") ? "*" : ctagName;
          extracted.push({
            id: nextId(),
            type: "style_color",
            label: (fgSelector === "*" ? "Có phần tử dùng màu chữ " : "Thẻ <" + fgSelector + "> có màu chữ ") + hexC,
            selector: fgSelector,
            property: "color",
            expected: hexC,
            weight: 10
          });
          colorCount += 1;
        }
      }
    }

    var centered = false;
    for (var a = 0; a < allEls.length; a++) {
      var ael = allEls[a];
      var acs = getComputedStyle(ael);
      if (acs.textAlign === "center" || (acs.display.indexOf("flex") !== -1 && acs.justifyContent === "center") || (acs.display.indexOf("grid") !== -1 && acs.justifyContent === "center")) {
        centered = true;
        break;
      }
    }
    if (centered) {
      extracted.push({
        id: nextId(),
        type: "style_align",
        label: "Căn giữa nội dung / bố cục",
        selector: "*",
        expected: "center",
        weight: 10
      });
    }

    return extracted;
  }

  function finish() {
    try {
      if (PAYLOAD.mode === "analyze") {
        var extracted = extractCriteriaFromDocument();
        window.parent.postMessage({
          source: "ccv-code-runner",
          runId: PAYLOAD.runId,
          mode: "analyze",
          extractedCriteria: extracted,
          consoleLogs: consoleLogs.slice(0, 30),
          errors: errors.slice(0, 20)
        }, "*");
      } else if (PAYLOAD.mode === "preview") {
        window.parent.postMessage({
          source: "ccv-code-runner",
          runId: PAYLOAD.runId,
          mode: "preview",
          consoleLogs: consoleLogs.slice(0, 50),
          errors: errors.slice(0, 30)
        }, "*");
      } else {
        var grade = evaluateCriteria(PAYLOAD.criteria || []);
        window.parent.postMessage({
          source: "ccv-code-runner",
          runId: PAYLOAD.runId,
          mode: "grade",
          result: grade
        }, "*");
      }
    } catch (err) {
      errors.push(err && err.message ? err.message : String(err));
      window.parent.postMessage({
        source: "ccv-code-runner",
        runId: PAYLOAD.runId,
        mode: PAYLOAD.mode,
        result: {
          percentage: 0,
          earnedPoints: 0,
          totalPoints: 100,
          passed: false,
          passedCount: 0,
          totalCount: (PAYLOAD.criteria || []).length,
          passThreshold: PAYLOAD.passThreshold || 100,
          results: [],
          consoleLogs: consoleLogs.slice(0, 50),
          errors: errors.slice(0, 30),
          evaluatedAt: new Date().toISOString()
        }
      }, "*");
    }
  }

  function scheduleFinish() {
    setTimeout(finish, 40);
  }

  if (document.readyState === "complete") {
    scheduleFinish();
  } else {
    window.addEventListener("load", scheduleFinish);
  }
})();
</script>`;

  const userJsBlock = combinedJs.trim()
    ? `<script>\ntry {\n${combinedJs.replace(/<\/script>/gi, "<\\/script>")}\n} catch (err) { console.error(err && err.message ? err.message : String(err)); }\n</script>`
    : "";

  const htmlTrimmed = htmlSource.trim();
  const isFullHtml = /<!doctype|<html[\s>]/i.test(htmlTrimmed);

  if (isFullHtml) {
    let doc = htmlSource;
    const headInsert = `${headConsoleHook}\n${combinedCss.trim() ? `<style>\n${combinedCss}\n</style>` : ""}`;
    if (/<head[^>]*>/i.test(doc)) {
      doc = doc.replace(/<head[^>]*>/i, (m) => `${m}\n${headConsoleHook}`);
      if (combinedCss.trim()) {
        doc = /<\/head>/i.test(doc)
          ? doc.replace(/<\/head>/i, () => `<style>\n${combinedCss}\n</style>\n</head>`)
          : `${doc}\n<style>\n${combinedCss}\n</style>`;
      }
    } else if (/<\/head>/i.test(doc)) {
      doc = doc.replace(/<\/head>/i, () => `${headInsert}\n</head>`);
    } else {
      doc = `${headInsert}\n${doc}`;
    }

    const scripts = `${userJsBlock}\n${bridgeScript}`;
    doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, () => `${scripts}\n</body>`) : `${doc}\n${scripts}`;
    return doc;
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${headConsoleHook}
<style>
${combinedCss}
</style>
</head>
<body>
${htmlSource}
${userJsBlock}
${bridgeScript}
</body>
</html>`;
}
