import { Link, useForm } from "@inertiajs/react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function Forgot({ sent = false, email = "" }: { sent?: boolean; email?: string }) {
  const form = useForm({ email });
  if (sent) {
    return (
      <AuthLayout title="Check your inbox">
        <Alert tone="success">
          If <b>{email}</b> has an account, a reset link is on its way. It works for 60 minutes.
        </Alert>
        <p className="text-sm text-muted">Nothing after a few minutes? Check spam, or <Link href="/password/forgot/" className="text-accent underline">try again</Link>.</p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Reset your password" deck="We'll email you a link to choose a new one.">
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.post("/password/forgot/"); }}>
        <Field label="Email" type="email" autoComplete="email" value={form.data.email}
          onChange={(v) => form.setData("email", v)} error={form.errors.email} autoFocus />
        <Button type="submit" loading={form.processing}>Send reset link</Button>
      </form>
      <p className="text-sm"><Link href="/login/" className="text-accent underline">Back to sign in</Link></p>
    </AuthLayout>
  );
}
