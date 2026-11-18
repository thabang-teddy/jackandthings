import { Link, useForm } from "@inertiajs/react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";

export default function Login({ email = "" }: { email?: string }) {
  const form = useForm({ email, password: "", remember: true });
  const formError = (form.errors as Record<string, string | undefined>).__all__;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(window.location.search).get("next");
    form.post(next ? `/login/?next=${encodeURIComponent(next)}` : "/login/", { onFinish: () => form.reset("password") });
  };
  return (
    <AuthLayout title="Sign in" deck="Your day, your money, your work — in one place.">
      {formError && <Alert tone="error">{formError}</Alert>}
      <form className="grid gap-4" noValidate onSubmit={submit}>
        <Field label="Email" type="email" autoComplete="email" value={form.data.email}
          onChange={(v) => form.setData("email", v)} error={form.errors.email} autoFocus />
        <Field label="Password" type="password" autoComplete="current-password" value={form.data.password}
          onChange={(v) => form.setData("password", v)} error={form.errors.password} />
        <Checkbox label="Remember me on this device" checked={form.data.remember} onChange={(v) => form.setData("remember", v)} />
        <Button type="submit" loading={form.processing}>Sign in</Button>
      </form>
      <p className="text-sm text-muted">
        <Link href="/password/forgot/" className="text-accent underline">Forgot password?</Link> ·{" "}
        <Link href="/register/" className="text-accent underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
