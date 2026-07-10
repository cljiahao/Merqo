"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { filterVendorGrants } from "@/lib/vendor-grants";
import type {
  GrantStatus,
  ProductOption,
  VendorGrant,
} from "@/lib/vendor-grants";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RevokeButton } from "./revoke-button";

export function VendorList({
  grants,
  products,
}: {
  grants: VendorGrant[];
  products: ProductOption[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<GrantStatus | "all">("all");
  const [slug, setSlug] = useState("all");

  const filtered = useMemo(
    () => filterVendorGrants(grants, { query, status, slug }),
    [grants, query, status, slug],
  );

  return (
    <>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="vendor-search" className="sr-only">
          Search by email
        </label>
        <Input
          id="vendor-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email…"
          className="sm:max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as GrantStatus | "all")}
        >
          <SelectTrigger aria-label="Status" className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="waitlist">Waitlist</SelectItem>
          </SelectContent>
        </Select>
        <Select value={slug} onValueChange={setSlug}>
          <SelectTrigger aria-label="Kit" className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kits</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {grants.length === 0
            ? "No vendor links yet."
            : "No vendors match these filters."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filtered.map((v) => (
            <li
              key={v.email}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <Link
                href={`/admin/vendors/${encodeURIComponent(v.email)}`}
                className="font-medium hover:underline"
              >
                {v.email}
              </Link>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {v.kits.map((k) => (
                  <span
                    key={k.slug}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background py-1 pl-2.5 pr-1 text-xs"
                  >
                    <span className="font-mono">{k.slug}</span>
                    <Badge
                      variant={k.status === "active" ? "success" : "muted"}
                      className="border-0 px-1.5 py-0"
                    >
                      {k.status}
                    </Badge>
                    <RevokeButton email={v.email} slug={k.slug} />
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
