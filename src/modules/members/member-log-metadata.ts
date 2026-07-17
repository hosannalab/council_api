export interface MemberFieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface MemberLogMetadata {
  /** @deprecated Prefer `changes` with from/to values */
  fields?: string[];
  changes?: MemberFieldChange[];
  churchName?: string;
  fromChurchName?: string;
  reason?: string;
}

export function serializeMemberLogMetadata(
  metadata: MemberLogMetadata,
): string | undefined {
  const hasContent = Object.values(metadata).some(
    (value) =>
      value !== undefined &&
      value !== null &&
      !(Array.isArray(value) && value.length === 0),
  );
  if (!hasContent) return undefined;
  return JSON.stringify(metadata);
}

export function parseMemberLogMetadata(detail: string | null): {
  metadata: MemberLogMetadata | null;
  legacyDetail: string | null;
} {
  if (!detail?.trim()) {
    return { metadata: null, legacyDetail: null };
  }

  try {
    const parsed = JSON.parse(detail) as MemberLogMetadata;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { metadata: parsed, legacyDetail: null };
    }
  } catch {
    // Plain-text legacy entries from older logs.
  }

  return { metadata: null, legacyDetail: detail };
}
