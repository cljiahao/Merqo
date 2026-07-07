"use client";
import { useState } from "react";
import { toast } from "sonner";
import { grantKitAction } from "./actions";
import { useAsyncAction } from "@/hooks/use-async-action";
import type { ProductOption } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GrantForm({ products }: { products: ProductOption[] }) {
  const { pending, run } = useAsyncAction();
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState(products[0]?.slug ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    run(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("slug", slug);
      const res = await grantKitAction(formData);
      if (res.success) {
        toast.success(`Granted ${slug} to ${email}`);
        setEmail("");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="grant-email" className="sr-only">
        Vendor email
      </label>
      <Input
        id="grant-email"
        name="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vendor@business.sg"
        className="sm:max-w-xs"
      />
      <Select value={slug} onValueChange={setSlug}>
        <SelectTrigger aria-label="Kit" className="sm:w-48">
          <SelectValue placeholder="Select a kit" />
        </SelectTrigger>
        <SelectContent>
          {products.map((p) => (
            <SelectItem key={p.slug} value={p.slug}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={pending || !slug}>
        {pending ? "Granting…" : "Grant access"}
      </Button>
    </form>
  );
}
