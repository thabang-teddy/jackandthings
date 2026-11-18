import { Link, useForm } from "@inertiajs/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function SettingsDelete() {
  const form = useForm({ confirm: "" });
  return (
    <>
      <PageHeader kicker="Settings" title="Delete your account" />
      <div className="grid max-w-lg gap-5">
        <Alert tone="error" title="This can't be undone.">
          Everything goes: notes, projects and tracked time, money records and receipts, training and photos, history and tokens.
          Backups are kept for 14 days and then deleted.
        </Alert>
        <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/settings/delete/"); }}>
          <Field label="Type DELETE to confirm" value={form.data.confirm} onChange={(v) => form.setData("confirm", v)}
            error={form.errors.confirm} autoComplete="off" />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={form.data.confirm !== "DELETE"} loading={form.processing}>Delete my account</Button>
            <Link href="/settings/" className="inline-flex h-10 items-center px-4 text-sm font-semibold">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
