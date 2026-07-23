export type VendorFeedbackRow = {
  id: string;
  kit_slug: string;
  nps: number;
  message: string | null;
  created_at: string;
};

export function groupVendorFeedbackByKit(
  rows: VendorFeedbackRow[],
): Map<string, VendorFeedbackRow[]> {
  const byKit = new Map<string, VendorFeedbackRow[]>();
  for (const row of rows) {
    const group = byKit.get(row.kit_slug);
    if (group) group.push(row);
    else byKit.set(row.kit_slug, [row]);
  }
  return new Map([...byKit.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
