import type { createServerClient } from "@/lib/supabase/server";

type LegalDocumentType = "terms" | "privacy" | "pilot";

// Bound each document independently so the API row cap cannot hide another document.
export async function latestLegalVersions<T extends LegalDocumentType>(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  email: string,
  documents: readonly T[],
): Promise<Partial<Record<T, string>>> {
  const entries = await Promise.all(
    documents.map(async (document) => {
      const { data, error } = await supabase
        .from("legal_acceptances")
        .select("doc_version")
        .eq("vendor_email", email.toLowerCase())
        .eq("doc_type", document)
        .order("accepted_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return [document, data?.[0]?.doc_version as string | undefined] as const;
    }),
  );
  const versions: Partial<Record<T, string>> = {};
  for (const [document, version] of entries) {
    if (version) versions[document] = version;
  }
  return versions;
}
