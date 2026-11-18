import { useForm } from "@inertiajs/react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function ConfirmPassword() {
  const form = useForm({ password: "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    form.post(`/password/confirm/${window.location.search}`, { onError: () => form.reset() });
  };
  return (
    <AuthLayout title="Confirm it's you" deck="This is a sensitive step. Enter your password to continue — we won't ask again for 3 hours.">
      <form className="grid gap-4" noValidate onSubmit={submit}>
        <Field label="Password" type="password" autoComplete="current-password" value={form.data.password}
          onChange={(v) => form.setData("password", v)} error={form.errors.password} autoFocus />
        <Button type="submit" loading={form.processing}>Confirm</Button>
      </form>
    </AuthLayout>
  );
}
