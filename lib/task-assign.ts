import { ObjectId } from "mongodb";
import { findAppDocument, type AppDocument } from "@/lib/app-data";
import { getDatabase } from "@/lib/mongodb";

export type ResolvedRecipient = {
  _id: ObjectId;
  name: string;
  email: string;
};

/**
 * Parses either `assignedToIds: string[]` or legacy `assignedToId: string`
 * from an assignment request body, deduplicates valid ObjectIds excluding the
 * creator, and verifies each account still exists.
 */
export async function resolveAssignRecipients(
  body: Record<string, unknown>,
  ownerId: ObjectId,
): Promise<{ recipients: ResolvedRecipient[]; error?: string; status?: number }> {
  const rawList: unknown[] = Array.isArray(body.assignedToIds)
    ? body.assignedToIds
    : body.assignedToId !== undefined
      ? [body.assignedToId]
      : [];

  const seen = new Set<string>();
  const targetIds: ObjectId[] = [];
  let includedSelf = false;

  for (const item of rawList) {
    if (typeof item !== "string" || !/^[0-9a-f]{24}$/i.test(item)) continue;
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const objId = new ObjectId(item);
    if (objId.equals(ownerId)) {
      includedSelf = true;
      continue;
    }
    targetIds.push(objId);
    if (targetIds.length >= 100) break;
  }

  if (targetIds.length === 0) {
    return {
      recipients: [],
      error: includedSelf
        ? "Bạn không thể giao bài cho chính mình."
        : "Hãy chọn ít nhất một tài khoản nhận bài.",
      status: 400,
    };
  }

  const usersCol = getDatabase().collection<{ _id: ObjectId; name?: string; email?: string }>("users");
  const found = await Promise.all(
    targetIds.map((recipientId) =>
      findAppDocument<AppDocument & { name?: string; email?: string }>(
        "users",
        recipientId.toString(),
        () => usersCol.findOne({ _id: recipientId }, { projection: { _id: 1, name: 1, email: 1 } }),
      ),
    ),
  );

  const recipients: ResolvedRecipient[] = [];
  for (const user of found) {
    if (user?.email) {
      recipients.push({
        _id: user._id,
        name: user.name || user.email,
        email: user.email,
      });
    }
  }

  if (recipients.length === 0) {
    return {
      recipients: [],
      error: "Không tìm thấy tài khoản nhận hợp lệ.",
      status: 404,
    };
  }

  return { recipients };
}
