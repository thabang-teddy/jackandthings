import "@fontsource-variable/inter";
import "@fontsource-variable/lora";
import "./styles/app.css";
import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import type { ComponentType, ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

type PageComponent = ComponentType<any> & { layout?: (page: ReactNode) => ReactNode };
type PageModule = { default: PageComponent };
const pages = import.meta.glob<PageModule>("./pages/**/*.tsx", { eager: true });

createInertiaApp({
  resolve: (name) => {
    const page = pages[`./pages/${name}.tsx`];
    if (!page) throw new Error(`Inertia page not found: ${name}`);
    // Every signed-in page shares the persistent shell; Auth pages bring their own layout.
    const Component = page.default;
    if (!name.startsWith("Auth/") && Component.layout === undefined) {
      Component.layout = (p: ReactNode) => <AppShell>{p}</AppShell>;
    }
    return page;
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />);
  },
  // Inertia v3 defaults to Laravel's names; Django uses these:
  http: { xsrfCookieName: "csrftoken", xsrfHeaderName: "X-CSRFToken" },
  progress: { color: "#1F4FD1" },
});
