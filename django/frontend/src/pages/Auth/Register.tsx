import { Link, useForm } from "@inertiajs/react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { FormError } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function Register() {
  const form = useForm({ name: "", email: "", password: "", password_confirm: "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    form.post("/register/", { onError: () => form.reset("password", "password_confirm") });
  };
  return (
    <AuthLayout title="Create your account" deck="One account for focus, projects, notes, money and training.">
      <FormError errors={form.errors as Record<string, string>} />
      <form className="grid gap-4" noValidate onSubmit={submit}>
        <Field label="Your name" autoComplete="name" value={form.data.name} onChange={(v) => form.setData("name", v)}
          error={form.errors.name} autoFocus />
        <Field label="Email" type="email" autoComplete="email" value={form.data.email}
          onChange={(v) => form.setData("email", v)} error={form.errors.email} />
        <Field label="Password" type="password" autoComplete="new-password" value={form.data.password}
          onChange={(v) => form.setData("password", v)} error={form.errors.password}
          hint="At least 12 characters. A short sentence works well." />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={form.data.password_confirm}
          onChange={(v) => form.setData("password_confirm", v)} error={form.errors.password_confirm} />
        <Button type="submit" loading={form.processing}>Create account</Button>
      </form>
      <p className="text-sm text-muted">Already have an account? <Link href="/login/" className="text-accent underline">Sign in</Link></p>
    </AuthLayout>
  );
}
