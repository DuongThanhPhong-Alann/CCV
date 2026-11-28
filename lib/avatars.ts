export type AvatarOption = {
  id: string;
  filename: string;
  label: string;
  src: string;
};

function makeAvatar(id: string, filename: string, label: string): AvatarOption {
  const nfc = filename.normalize("NFC");
  return {
    id,
    filename: nfc,
    label,
    src: `/images/${encodeURIComponent(nfc)}`,
  };
}

export const PANDA_AVATAR = makeAvatar(
  "panda",
  "Gương mặt gấu trúc kawaii đáng yêu.png",
  "Gấu trúc",
);

export const AVATAR_OPTIONS: AvatarOption[] = [
  PANDA_AVATAR,
  makeAvatar("cat", "Mèo con kawaii vui vẻ.png", "Mèo con"),
  makeAvatar("dog", "Huy Hiệu Chú Cún Kawaii Winking.png", "Chú cún"),
  makeAvatar("fox", "Cáo cam kawaii trong huy hiệu xanh pastel.png", "Cáo cam"),
  makeAvatar("lion", "Sư tử kawaii bờm cam đáng yêu.png", "Sư tử"),
  makeAvatar("elephant", "Huy Hiệu Voi Con Kawaii Dễ Thương.png", "Voi con"),
  makeAvatar("dolphin", "Cá Heo Kawaii Nhảy Sóng.png", "Cá heo"),
  makeAvatar("butterfly", "Bướm kawaii xanh pastel lấp lánh.png", "Bướm xanh"),
  makeAvatar("dragonfly", "Chuồn chuồn kawaii giữa trời xanh.png", "Chuồn chuồn"),
  makeAvatar("peacock", "Công xanh đáng yêu lấp lánh.png", "Công xanh"),
  makeAvatar("bee", "Ong mật dễ thương giữa hoa trời.png", "Ong mật"),
];

const RANDOM_POOL_FOR_OTHERS = AVATAR_OPTIONS.filter((a) => a.id !== PANDA_AVATAR.id);

export function isPandaDefaultAccount(email?: string | null): boolean {
  const clean = (email ?? "").trim().toLowerCase();
  return clean === "duongthanhphong1618@gmail.com" || clean.startsWith("duongthanhphong1618@");
}

export function findAvatarOption(raw?: string | null): AvatarOption | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // keep raw string
  }
  const normalized = decoded.normalize("NFC");
  for (const option of AVATAR_OPTIONS) {
    if (
      option.src === trimmed ||
      option.id === trimmed ||
      option.filename === normalized ||
      `/images/${option.filename}` === normalized
    ) {
      return option;
    }
  }
  return null;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickDeterministicAvatar(seed: string): AvatarOption {
  const pool = RANDOM_POOL_FOR_OTHERS.length > 0 ? RANDOM_POOL_FOR_OTHERS : AVATAR_OPTIONS;
  const idx = stableHash(seed.toLowerCase()) % pool.length;
  return pool[idx];
}

export function pickRandomAvatarForNewUser(email?: string | null): AvatarOption {
  if (isPandaDefaultAccount(email)) return PANDA_AVATAR;
  const pool = RANDOM_POOL_FOR_OTHERS.length > 0 ? RANDOM_POOL_FOR_OTHERS : AVATAR_OPTIONS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? AVATAR_OPTIONS[0];
}

export function resolveUserAvatar(params: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): string {
  const matched = findAvatarOption(params.image);
  if (matched) return matched.src;
  if (isPandaDefaultAccount(params.email)) return PANDA_AVATAR.src;
  const seed = (params.email || params.id || params.name || "user").trim();
  return pickDeterministicAvatar(seed).src;
}
