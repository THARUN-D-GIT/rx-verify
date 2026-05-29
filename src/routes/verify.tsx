import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QrCode, ShieldCheck, ShieldAlert, Pill, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "Verify medicine — MediVerify" }] }),
  component: VerifyPage,
});

type Result =
  | { kind: "ok"; batch: any }
  | { kind: "invalid"; reason: string }
  | null;

function VerifyPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    const { data: batch, error: batchError } = await (supabase as any)
  .from("qr_verification")
  .select("*")
  .eq("qr_code", code.trim())
  .maybeSingle();
  console.log("BATCH DATA:", batch);
    if (batchError) {
      setResult({ kind: "invalid", reason: batchError.message });
      setLoading(false);
      return;
    }

    let batchWithMedicine: any = batch;
    if (batch?.medicine_id) {
      const { data: med, error: medError } = await supabase
        .from("medicines")
        .select("*")
        .eq("id", batch.medicine_id)
        .maybeSingle();
      if (medError) {
        setResult({ kind: "invalid", reason: medError.message });
        setLoading(false);
        return;
      }
      batchWithMedicine = { ...batch, medicines: med ?? null };
    }

    let res: Result;
    if (!batch) res = { kind: "invalid", reason: "No matching batch found — likely counterfeit." };
    else if (!batchWithMedicine.is_valid) res = { kind: "invalid", reason: "Batch has been flagged as invalid." };
    else if (batchWithMedicine.expiry_date && new Date(batchWithMedicine.expiry_date) < new Date()) res = { kind: "invalid", reason: "Medicine is expired." };
    else res = { kind: "ok", batch: batchWithMedicine };

    await (supabase as any).from("verification_logs").insert({
      qr_code: code.trim(),
      user_id: user?.id ?? null,
      result: res.kind === "ok" ? "authentic" : "invalid",
    });

    setResult(res);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-soft">
      <SiteHeader />
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-hero text-primary-foreground shadow-elegant">
            <QrCode className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">QR verification</h1>
          <p className="mt-2 text-muted-foreground">Enter the QR code printed on the pack to confirm authenticity.</p>
        </div>

        <Card className="border bg-card p-6 shadow-card">
          <form onSubmit={verify} className="flex gap-2">
            <Input placeholder="e.g. MV-7H3K-9XQ2" value={code} onChange={(e) => setCode(e.target.value)} className="h-11" />
            <Button type="submit" disabled={loading} className="h-11">{loading ? "Verifying..." : "Verify"}</Button>
          </form>

          {result?.kind === "ok" && (
            <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-success" />
                <div>
                  <div className="text-lg font-semibold text-success">Authentic medicine</div>
                  <div className="text-sm text-success/80">This batch is verified and on record.</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2"><Pill className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Medicine</div><div className="font-medium">{result.batch.medicines?.name}</div></div></div>
                <div className="flex items-start gap-2"><Pill className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Manufacturer</div><div className="font-medium">{result.batch.medicines?.manufacturer ?? "—"}</div></div></div>
                <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Batch</div><div className="font-medium">{result.batch.batch_number}</div></div></div>
                <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Expiry</div><div className="font-medium">{result.batch.expiry_date ?? "—"}</div></div></div>
              </div>
            </div>
          )}

          {result?.kind === "invalid" && (
            <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <div>
                  <div className="text-lg font-semibold text-destructive">Verification failed</div>
                  <div className="text-sm text-destructive/80">{result.reason}</div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Do not consume the medicine. Report this to your pharmacist or the authorities.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
