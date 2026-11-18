import { Link } from "@inertiajs/react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";

/** Shown only when a verification link is bad or used; a good link redirects straight to Today. */
export default function Verify({ expired = true }: { expired?: boolean }) {
  return (
    <AuthLayout title="We couldn't verify that link">
      {expired && <Alert tone="warn">The link is old or has already been used. Sign in and press “Send it again” in the banner.</Alert>}
      <Link href="/" className="text-accent underline">Go to Today</Link>
    </AuthLayout>
  );
}
