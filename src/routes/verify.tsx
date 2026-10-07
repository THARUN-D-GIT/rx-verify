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

type VerifiedBatch = {
  batch_number: string;
  expiry_date: string | null;
  medicines: { name: string; manufacturer: string | null } | null;
};

type Result =
  | { kind: "ok"; batch: VerifiedBatch }
  | { kind: "invalid"; reason: string }
  | null;

const UNAVAILABLE_MESSAGE = "Verification is temporarily unavailable. Please try again.";

function VerifyPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.trim();
    if (!normalizedCode) return;
    if (normalizedCode.length > 128) {
      setResult({ kind: "invalid", reason: "Enter a valid QR code and try again." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data: batch, error: batchError } = await supabase
        .from("medicine_batches")
        .select("id, medicine_id, batch_number, qr_code, expiry_date, is_valid")
        .eq("qr_code", normalizedCode)
        .maybeSingle();

      if (batchError) {
        setResult({ kind: "invalid", reason: UNAVAILABLE_MESSAGE });
        return;
      }

      if (!batch) {
        setResult({
          kind: "invalid",
          reason: "No registered batch matches this code. Check with the manufacturer or a pharmacist before use.",
        });
        return;
      }

      const { data: medicine, error: medicineError } = await supabase
        .from("medicines")
        .select("name, manufacturer")
        .eq("id", batch.medicine_id)
        .maybeSingle();

      if (medicineError) {
        setResult({ kind: "invalid", reason: UNAVAILABLE_MESSAGE });
        return;
      }

      const isExpired =
        batch.expiry_date !== null &&
        batch.expiry_date < new Date().toISOString().slice(0, 10);

      const nextResult: Result = !batch.is_valid
        ? { kind: "invalid", reason: "This batch has been flagged as invalid. Contact the manufacturer or a pharmacist." }
        : isExpired
          ? { kind: "invalid", reason: "The registered batch is past its listed expiry date." }
          : {
              kind: "ok",
              batch: {
                batch_number: batch.batch_number,
                expiry_date: batch.expiry_date,
                medicines: medicine,
              },
            };

      // Logging is best-effort; a log write failure must not change the verification result.
      await supabase.from("verification_logs").insert({
        qr_code: normalizedCode,
        user_id: user?.id ?? null,
        result: nextResult.kind === "ok" ? "authentic" : "invalid",
      });

      setResult(nextResult);
    } catch {
      setResult({ kind: "invalid", reason: UNAVAILABLE_MESSAGE });
    } finally {
      setLoading(false);
    }
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
          <p className="mt-2 text-muted-foreground">Enter the QR code printed on the pack to check it against the batch registry.</p>
        </div>

        <Card className="border bg-card p-6 shadow-card">
          <form onSubmit={verify} className="flex gap-2">
            <Input
              placeholder="e.g. MV-7H3K-9XQ2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={128}
              required
              className="h-11"
              aria-label="Medicine QR code"
            />
            <Button type="submit" disabled={loading} className="h-11">
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </form>

          {result?.kind === "ok" && (
            <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-success" />
                <div>
                  <div className="text-lg font-semibold text-success">QR registry match found</div>
                  <div className="text-sm text-success/80">This code matches a batch record in the registry.</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2"><Pill className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Medicine</div><div className="font-medium">{result.batch.medicines?.name ?? "—"}</div></div></div>
                <div className="flex items-start gap-2"><Pill className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Manufacturer</div><div className="font-medium">{result.batch.medicines?.manufacturer ?? "—"}</div></div></div>
                <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Batch</div><div className="font-medium">{result.batch.batch_number}</div></div></div>
                <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" /><div><div className="text-muted-foreground">Expiry</div><div className="font-medium">{result.batch.expiry_date ?? "—"}</div></div></div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                A matching code confirms a registry record; copied codes can still appear on counterfeit packaging. Contact the manufacturer or a pharmacist if anything seems wrong.
              </p>
            </div>
          )}

          {result?.kind === "invalid" && (
            <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <div>
                  <div className="text-lg font-semibold text-destructive">Unable to verify this code</div>
                  <div className="text-sm text-destructive/80">{result.reason}</div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                If you cannot confirm the product with the manufacturer or a pharmacist, do not use it.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
