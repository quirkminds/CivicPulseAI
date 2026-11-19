import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App.tsx";
import "./index.css";

// /dev es la galería del design system. Con `vite build`, DEV es false, la condición se pliega
// y el import dinámico desaparece del bundle: la galería nunca llega a producción.
const Root =
  import.meta.env.DEV && window.location.pathname.startsWith("/dev")
    ? lazy(() => import("./dev/dev-gallery.tsx"))
    : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <Suspense>
        <Root />
      </Suspense>
    </TooltipProvider>
  </StrictMode>,
);
