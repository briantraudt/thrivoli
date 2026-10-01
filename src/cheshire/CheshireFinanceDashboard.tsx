import { useEffect, useState } from "react";
import { cheshireSupabase } from "../lib/cheshireSupabase";
import { parseFinanceSnapshot, type FinanceSnapshot } from "./finance";
import { useIntake } from "./intakeContext";
import { createRequestGuard } from "./requestGuard";
import {
  CheshireFinanceDashboardView,
  type FinanceLoadState,
} from "./CheshireFinanceDashboardView";

export function CheshireFinanceDashboard() {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [state, setState] = useState<FinanceLoadState>("loading");
  const { setReferenceSnapshot } = useIntake();
  const [snapshotOwner, setSnapshotOwner] = useState<string | null>(null);
  useEffect(() => { setReferenceSnapshot(snapshot, snapshotOwner); }, [snapshot, snapshotOwner, setReferenceSnapshot]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const requests = createRequestGuard();
    let identity: string | null | undefined;
    const load = async (userId: string, version: number) => {
      const current = () => active && requests.isCurrent(version);
      if (!current()) return;
      setState("loading");
      setSnapshot(null);
      try {
        const access = await cheshireSupabase
          .from("cheshire_finance_reader")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!current()) return;
        if (access.error) {
          setState("error");
          return;
        }
        if (!access.data) {
          setState("no-access");
          return;
        }
        const result = await cheshireSupabase
          .from("cheshire_finance_snapshot")
          .select(
            "source_name,cadence,effective_month,imported_at,overhead_rows,cost_basis,basis_confirmed_at,basis_note,revision_id",
          )
          .eq("id", "current-overhead")
          .maybeSingle();
        if (!current()) return;
        if (result.error) {
          setState("error");
          return;
        }
        if (!result.data) {
          setState("empty");
          return;
        }
        setSnapshot(parseFinanceSnapshot(result.data));
        setSnapshotOwner(userId);
        setState("ready");
      } catch {
        if (current()) setState("error");
      }
    };
    const changeIdentity = (userId: string | null) => {
      if (!active || identity === userId) return;
      identity = userId;
      const version = requests.begin();
      setSnapshot(null);
      setState(userId ? "loading" : "no-access");
      // Do not start Supabase work inside its synchronous auth callback.
      if (userId)
        setTimeout(() => {
          void load(userId, version);
        }, 0);
    };
    const { data: authListener } = cheshireSupabase.auth.onAuthStateChange(
      (_event, session) => {
        changeIdentity(session?.user.id ?? null);
      },
    );
    void cheshireSupabase.auth.getSession().then(({ data }) => {
      if (!requests.hasStarted()) changeIdentity(data.session?.user.id ?? null);
    });
    return () => {
      active = false;
      requests.invalidate();
      authListener.subscription.unsubscribe();
    };
  }, [attempt]);
  return (
    <CheshireFinanceDashboardView
      snapshot={snapshot}
      state={state}
      onRefresh={() => {
        setSnapshot(null);
        setState("loading");
        setAttempt((value) => value + 1);
      }}
    />
  );
}
