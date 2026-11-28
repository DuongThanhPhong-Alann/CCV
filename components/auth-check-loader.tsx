const GRADIENT_IDS = ["you-grad-b", "you-grad-c", "you-grad-d"] as const;

function normalizeLoaderLabel(raw?: string | null): string {
  if (!raw || !raw.trim()) return "";
  let cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.includes("@") && !cleaned.includes(" ")) {
    cleaned = cleaned.split("@")[0] || "";
  }
  const upper = cleaned.toLocaleUpperCase("vi-VN").trim();
  if (!upper) return "";
  if (upper.length <= 24) return upper;
  const words = upper.split(" ");
  let out = "";
  for (const word of words) {
    const candidate = out ? `${out} ${word}` : word;
    if (candidate.length > 24) break;
    out = candidate;
  }
  return out || upper.slice(0, 24);
}

function glyphViewBoxWidth(ch: string): number {
  const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (base === "I" || base === "1" || base === "|") return 28;
  if (base === "J" || base === "L" || base === "F" || base === "T" || base === "7") return 46;
  if (base === "M" || base === "W") return 66;
  if (base === "O" || base === "Q" || base === "G" || base === "D" || ch === "Đ" || ch === "Ơ" || ch === "Ư") return 58;
  return 52;
}

export default function AuthCheckLoader({
  displayName,
  message = "Đang kiểm tra đăng nhập…",
}: {
  displayName?: string | null;
  message?: string;
}) {
  const label = normalizeLoaderLabel(displayName);
  const useDefaultYou = !label || label === "YOU";
  const words = useDefaultYou ? [] : label.split(" ").filter(Boolean);
  const totalChars = label.replace(/\s+/g, "").length;
  const sizeClass =
    totalChars > 14 ? "is-compact" : totalChars > 8 ? "is-medium" : "";

  let globalCharIndex = 0;

  return (
    <div className="auth-checking-screen" role="status" aria-live="polite">
      <svg height="0" width="0" viewBox="0 0 64 64" className="auth-you-abs" aria-hidden="true">
        <defs xmlns="http://www.w3.org/2000/svg">
          <linearGradient
            gradientUnits="userSpaceOnUse"
            y2="2"
            x2="0"
            y1="62"
            x1="0"
            id="you-grad-b"
          >
            <stop stopColor="#973BED" />
            <stop stopColor="#007CFF" offset="1" />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            y2="0"
            x2="0"
            y1="64"
            x1="0"
            id="you-grad-c"
          >
            <stop stopColor="#FFC800" />
            <stop stopColor="#F0F" offset="1" />
            <animateTransform
              repeatCount="indefinite"
              keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1"
              keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1"
              dur="8s"
              values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32"
              type="rotate"
              attributeName="gradientTransform"
            />
          </linearGradient>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            y2="2"
            x2="0"
            y1="62"
            x1="0"
            id="you-grad-d"
          >
            <stop stopColor="#00E0ED" />
            <stop stopColor="#00DA72" offset="1" />
          </linearGradient>
        </defs>
      </svg>

      {useDefaultYou ? (
        <div className="auth-you-loader" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 64 64"
            height="64"
            width="64"
            className="auth-you-svg"
          >
            <path
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth="8"
              stroke="url(#you-grad-b)"
              d="M 54.722656,3.9726563 A 2.0002,2.0002 0 0 0 54.941406,4 h 5.007813 C 58.955121,17.046124 49.099667,27.677057 36.121094,29.580078 a 2.0002,2.0002 0 0 0 -1.708985,1.978516 V 60 H 29.587891 V 31.558594 A 2.0002,2.0002 0 0 0 27.878906,29.580078 C 14.900333,27.677057 5.0448787,17.046124 4.0507812,4 H 9.28125 c 1.231666,11.63657 10.984383,20.554048 22.6875,20.734375 a 2.0002,2.0002 0 0 0 0.02344,0 c 11.806958,0.04283 21.70649,-9.003371 22.730469,-20.7617187 z"
              className="auth-you-dash"
              pathLength={360}
            />
          </svg>

          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 64 64"
            height="64"
            width="64"
            className="auth-you-svg"
          >
            <path
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth="10"
              stroke="url(#you-grad-c)"
              d="M 32 32 m 0 -27 a 27 27 0 1 1 0 54 a 27 27 0 1 1 0 -54"
              className="auth-you-spin"
              pathLength={360}
            />
          </svg>

          <div className="auth-you-gap" />

          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 64 64"
            height="64"
            width="64"
            className="auth-you-svg"
          >
            <path
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth="8"
              stroke="url(#you-grad-d)"
              d="M 4,4 h 4.6230469 v 25.919922 c -0.00276,11.916203 9.8364941,21.550422 21.7500001,21.296875 11.616666,-0.240651 21.014356,-9.63894 21.253906,-21.25586 a 2.0002,2.0002 0 0 0 0,-0.04102 V 4 H 56.25 v 25.919922 c 0,14.33873 -11.581192,25.919922 -25.919922,25.919922 a 2.0002,2.0002 0 0 0 -0.0293,0 C 15.812309,56.052941 3.998433,44.409961 4,29.919922 Z"
              className="auth-you-dash"
              pathLength={360}
            />
          </svg>
        </div>
      ) : (
        <div
          className={`auth-you-loader auth-name-loader ${sizeClass}`}
          aria-label={label}
        >
          {words.map((word, wordIdx) => (
            <div className="auth-name-word" key={`${word}-${wordIdx}`}>
              {Array.from(word).map((ch, chIdx) => {
                const idx = globalCharIndex++;
                const gradId = GRADIENT_IDS[idx % GRADIENT_IDS.length];
                const vbWidth = glyphViewBoxWidth(ch);
                return (
                  <svg
                    key={`${wordIdx}-${chIdx}-${ch}`}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox={`0 -10 ${vbWidth} 80`}
                    className="auth-name-glyph-svg"
                    style={{ aspectRatio: `${vbWidth} / 80` }}
                    aria-hidden="true"
                  >
                    <text
                      x={vbWidth / 2}
                      y="54"
                      textAnchor="middle"
                      fill="none"
                      stroke={`url(#${gradId})`}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="auth-name-glyph-text"
                      style={{ animationDelay: `${(idx % 6) * 0.11}s` }}
                    >
                      {ch}
                    </text>
                  </svg>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p className="auth-checking-text">{message}</p>
    </div>
  );
}
