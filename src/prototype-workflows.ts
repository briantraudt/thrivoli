import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "./chat-widget";
import "./mobile-dashboard-layout";

type Workflow =
  | { type: "sign-note"; noteId?: string }
  | { type: "submit-claim-batch"; batchId?: string }
  | { type: "request-reauthorization"; authorizationId?: string }
  | { type: "update-appointment"; appointmentId?: string; status: string };

type WorkflowResult = { ok: boolean; message: string };

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client: SupabaseClient | null = url && key ? createClient(url, key) : null;

function installMobileViewportGuard() {
  const style = document.createElement("style");
  style.dataset.thrivoliMobileViewport = "true";
  style.textContent = `
    html,
    body,
    x-dc,
    .app-shell,
    .app-content,
    .app-main {
      max-width: 100%;
    }

    x-dc {
      display: block;
      width: 100%;
      min-width: 0;
    }

    @media (max-width: 920px) {
      html,
      body {
        width: 100% !important;
        max-width: 100vw !important;
        min-height: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior-x: none;
        -webkit-overflow-scrolling: touch;
      }

      body > x-dc,
      x-dc {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100vw !important;
        min-height: 100dvh !important;
        margin: 0 !important;
        overflow-x: clip !important;
        overflow-y: visible !important;
      }

      x-dc > .app-shell,
      .app-shell {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100vw !important;
        height: auto !important;
        min-height: 100dvh !important;
        margin: 0 !important;
        overflow-x: clip !important;
        overflow-y: visible !important;
      }

      .app-sidebar {
        position: fixed !important;
        inset: 0 auto 0 0 !important;
        width: min(84vw, 300px) !important;
        max-width: 300px !important;
        height: 100dvh !important;
        margin: 0 !important;
      }

      .app-content {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100vw !important;
        min-height: 100dvh !important;
        margin: 0 !important;
        transform: none !important;
        overflow: visible !important;
      }

      .app-main {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100vw !important;
        height: auto !important;
        min-height: 100dvh !important;
        margin: 0 !important;
        overflow-x: hidden !important;
        overflow-y: visible !important;
        -webkit-overflow-scrolling: touch;
      }

      .app-main > *,
      .page-heading,
      .page-title-wrap,
      .page-actions,
      .responsive-split,
      .team-grid {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      .page-actions {
        width: 100% !important;
      }

      .page-actions > div:first-child {
        width: 100% !important;
        max-width: none !important;
      }

      .app-main img,
      .app-main svg,
      .app-main canvas {
        max-width: 100%;
      }

      .table-wrap,
      .team-tabs,
      [data-horizontal-scroll] {
        max-width: 100%;
        overflow-x: auto !important;
        overscroll-behavior-x: contain;
      }
    }
  `;
  document.head.appendChild(style);

  const resetHorizontalPosition = () => {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    document.querySelectorAll<HTMLElement>(".app-shell, .app-content, .app-main").forEach((element) => {
      element.scrollLeft = 0;
    });
    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
  };

  resetHorizontalPosition();
  requestAnimationFrame(resetHorizontalPosition);
  window.addEventListener("resize", resetHorizontalPosition, { passive: true });
  window.addEventListener("orientationchange", resetHorizontalPosition, { passive: true });
}

installMobileViewportGuard();

async function requireSession(): Promise<WorkflowResult | null> {
  if (!client) {
    return { ok: false, message: "Live data is not configured. This action remains in demo mode." };
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    return { ok: false, message: "Sign in to complete this live workflow." };
  }
  return null;
}

async function updateOne(
  table: string,
  id: string | undefined,
  values: Record<string, unknown>,
): Promise<WorkflowResult> {
  if (!id) return { ok: false, message: "Open a live record before completing this action." };
  const { data, error } = await client!.from(table).update(values).eq("id", id).select("id").maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "The record was not changed. Check your clinic access." };
  return { ok: true, message: "Workflow completed." };
}

async function execute(workflow: Workflow): Promise<WorkflowResult> {
  const sessionError = await requireSession();
  if (sessionError) return sessionError;

  switch (workflow.type) {
    case "sign-note":
      return updateOne("clinical_note", workflow.noteId, {
        status: "signed",
        signed_at: new Date().toISOString(),
        locked_at: new Date().toISOString(),
      });
    case "submit-claim-batch":
      return updateOne("claim_batch", workflow.batchId, {
        status: "transmitted",
        transmitted_at: new Date().toISOString(),
      });
    case "request-reauthorization":
      return updateOne("patient_authorization", workflow.authorizationId, {
        status: "requested",
        submitted_at: new Date().toISOString(),
      });
    case "update-appointment":
      return updateOne("appointment", workflow.appointmentId, { status: workflow.status });
  }
}

async function loadClinicWorkspace() {
  const sessionError = await requireSession();
  if (sessionError) return { ok: false as const, message: sessionError.message };

  const [appointments, patients, claims, tasks] = await Promise.all([
    client!.from("appointment").select("*, patient(*), clinician(*), location(*)").order("starts_at").limit(250),
    client!.from("patient").select("*").order("last_name").limit(250),
    client!.from("claim").select("*, claim_line(*)").order("created_at", { ascending: false }).limit(250),
    client!.from("task").select("*").order("due_at").limit(250),
  ]);
  const error = appointments.error ?? patients.error ?? claims.error ?? tasks.error;
  if (error) return { ok: false as const, message: error.message };
  return {
    ok: true as const,
    data: {
      appointments: appointments.data,
      patients: patients.data,
      claims: claims.data,
      tasks: tasks.data,
    },
  };
}

window.thrivoliWorkflows = { execute, loadClinicWorkspace };

declare global {
  interface Window {
    thrivoliWorkflows: {
      execute: (workflow: Workflow) => Promise<WorkflowResult>;
      loadClinicWorkspace: typeof loadClinicWorkspace;
    };
  }
}
