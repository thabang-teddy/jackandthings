import { Link, useForm } from "@inertiajs/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormError } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import type { Option, Theme } from "@/lib/types";

type Props = { profile: { name: string; email: string; theme: Theme; email_verified: boolean };
  prefs: { email_weekly_summary: boolean; email_cap_breached: boolean; email_recurring_due: boolean }; themes: Option[] };
const opts = { preserveScroll: true };

export default function SettingsIndex({ profile, prefs, themes }: Props) {
  return (
    <>
      <PageHeader kicker="Settings" title="Settings" />
      <div className="grid max-w-2xl gap-12">
        <Profile profile={profile} themes={themes} />
        <Email profile={profile} />
        <Password />
        <Prefs prefs={prefs} />
        <Section kicker="Danger zone">
          <p className="mb-3 text-sm">Delete your account and everything in it: notes, projects, money, training, history and uploaded files.</p>
          <Link href="/settings/delete/" className="inline-flex h-10 items-center rounded-[3px] bg-neg px-4 text-sm font-semibold text-bg">Delete account…</Link>
        </Section>
      </div>
    </>
  );
}

function Profile({ profile, themes }: Pick<Props, "profile" | "themes">) {
  const form = useForm({ name: profile.name, theme: profile.theme });
  const pickTheme = (t: Theme) => {
    form.setData("theme", t);
    document.documentElement.dataset.theme = t; // show it instantly; saving makes it stick
  };
  return (
    <Section kicker="Profile">
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); form.put("/settings/profile/", opts); }}>
        <Field label="Name" value={form.data.name} onChange={(v) => form.setData("name", v)} error={form.errors.name} autoComplete="name" />
        <div className="grid gap-1.5">
          <span className="text-[13px] font-semibold">Theme</span>
          <Segmented label="Theme" value={form.data.theme} onChange={pickTheme} options={themes.map((t) => ({ value: t.value as Theme, label: t.label }))} />
        </div>
        <div><Button type="submit" loading={form.processing} disabled={!form.isDirty}>Save profile</Button></div>
      </form>
    </Section>
  );
}

function Email({ profile }: Pick<Props, "profile">) {
  const form = useForm({ email: profile.email });
  return (
    <Section kicker="Email">
      <p className="mb-3 text-sm">{profile.email} {profile.email_verified ? <Badge tone="pos">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}</p>
      <form className="grid gap-3" noValidate onSubmit={(e) => { e.preventDefault(); form.put("/settings/email/", opts); }}>
        <Field label="New email" type="email" value={form.data.email} onChange={(v) => form.setData("email", v)} error={form.errors.email}
          hint="We'll ask for your password, then send a link to the new address." />
        <div><Button type="submit" variant="secondary" loading={form.processing} disabled={!form.isDirty}>Change email</Button></div>
      </form>
    </Section>
  );
}

function Password() {
  const form = useForm({ old_password: "", new_password1: "", new_password2: "" });
  return (
    <Section kicker="Password">
      <form className="grid gap-3" noValidate onSubmit={(e) => { e.preventDefault(); form.put("/settings/password/", { ...opts, onFinish: () => form.reset() }); }}>
        <FormError errors={form.errors as Record<string, string>} />
        <Field label="Current password" type="password" autoComplete="current-password" value={form.data.old_password}
          onChange={(v) => form.setData("old_password", v)} error={form.errors.old_password} />
        <Field label="New password" type="password" autoComplete="new-password" value={form.data.new_password1}
          onChange={(v) => form.setData("new_password1", v)} error={form.errors.new_password1} hint="At least 12 characters." />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={form.data.new_password2}
          onChange={(v) => form.setData("new_password2", v)} error={form.errors.new_password2} />
        <p className="text-[13px] text-muted">Changing it signs you out everywhere else.</p>
        <div><Button type="submit" variant="secondary" loading={form.processing}>Change password</Button></div>
      </form>
    </Section>
  );
}

function Prefs({ prefs }: Pick<Props, "prefs">) {
  const form = useForm(prefs);
  const flip = (k: keyof typeof prefs) => (v: boolean) => {
    form.setData(k, v);
    form.transform((d) => ({ ...d, [k]: v }));
    form.put("/settings/prefs/", opts);
  };
  return (
    <Section kicker="Notifications">
      <p className="mb-2 text-[13px] text-muted">Email notifications arrive in a later release. Your choices are saved now.</p>
      <Toggle label="Weekly summary" checked={form.data.email_weekly_summary} onChange={flip("email_weekly_summary")} />
      <Toggle label="A cap is broken" checked={form.data.email_cap_breached} onChange={flip("email_cap_breached")} />
      <Toggle label="A recurring item is due" checked={form.data.email_recurring_due} onChange={flip("email_recurring_due")} />
    </Section>
  );
}
