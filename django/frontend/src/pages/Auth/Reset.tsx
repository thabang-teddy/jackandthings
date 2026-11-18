import { Link, useForm } from "@inertiajs/react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function Reset({ expired = false, email = "" }: { expired?: boolean; email?: string }) {
  const form = useForm({ new_password1: "", new_password2: "" });
  if (expired) {
    return (
      <AuthLayout title="That link has expired">
        <Alert tone="warn">Reset links work once, for 60 minutes. Ask for a new one.</Alert>
        <Link href="/password/forgot/" className="text-accent underline">Send a new link</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Choose a new password" deck={email ? `For ${email}` : undefined}>
      <form className="grid gap-4" noValidate
        onSubmit={(e) => { e.preventDefault(); form.post(window.location.pathname); }}>
        <Field label="New password" type="password" autoComplete="new-password" value={form.data.new_password1}
          onChange={(v) => form.setData("new_password1", v)} error={form.errors.new_password1} autoFocus
          hint="At least 12 characters." />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={form.data.new_password2}
          onChange={(v) => form.setData("new_password2", v)} error={form.errors.new_password2} />
        <Button type="submit" loading={form.processing}>Save password and sign in</Button>
      </form>
    </AuthLayout>
  );
}
