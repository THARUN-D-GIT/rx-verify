import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pill, Building2, ShieldCheck, QrCode, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin dashboard — MediVerify" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const meds = useQuery({
    queryKey: ["admin-meds"],
    queryFn: async () => (await supabase.from("medicines").select("*").order("name")).data ?? [],
  });
  const pharmacies = useQuery({
    queryKey: ["admin-pharm"],
    queryFn: async () => (await supabase.from("pharmacies").select("*").order("name")).data ?? [],
  });
  const batches = useQuery({
    queryKey: ["admin-batches"],
    queryFn: async () => {
      const { data: batchRows, error: batchError } = await supabase
        .from("medicine_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (batchError) throw batchError;

      const medicineIds = Array.from(new Set((batchRows ?? []).map((b: any) => b?.medicine_id).filter(Boolean))) as string[];
      const { data: meds, error: medsError } = medicineIds.length
        ? await supabase.from("medicines").select("id,name").in("id", medicineIds)
        : { data: [], error: null as any };
      if (medsError) throw medsError;

      const medById = new Map<string, any>((meds ?? []).map((m: any) => [m.id, m]));
      return (batchRows ?? []).map((b: any) => ({
        ...b,
        medicines: medById.get(b.medicine_id) ?? null,
      }));
    },
  });
  const logs = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => (await supabase.from("verification_logs").select("*").order("scanned_at", { ascending: false }).limit(50)).data ?? [],
  });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  if (loading) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-soft">
        <SiteHeader />
        <div className="container mx-auto max-w-xl px-4 py-20 text-center">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-muted-foreground">
            Your account doesn't have admin privileges. To bootstrap the first admin, run this SQL in Lovable Cloud after signing up:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-card p-4 text-left text-xs">
{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${user?.id ?? "<your-user-id>"}', 'admin');`}
          </pre>
          <Button asChild className="mt-6"><Link to="/">Back to home</Link></Button>
        </div>
      </div>
    );
  }

  const setRole = async (userId: string, role: "admin" | "pharmacy_staff" | "user") => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Role granted");
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  return (
    <div className="min-h-screen bg-soft">
      <SiteHeader />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage the entire MediVerify platform.</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <Stat icon={Pill} label="Medicines" value={meds.data?.length ?? 0} />
          <Stat icon={Building2} label="Pharmacies" value={pharmacies.data?.length ?? 0} />
          <Stat icon={QrCode} label="QR batches" value={batches.data?.length ?? 0} />
          <Stat icon={Users} label="Users" value={users.data?.length ?? 0} />
        </div>

        <Tabs defaultValue="medicines">
          <TabsList>
            <TabsTrigger value="medicines">Medicines</TabsTrigger>
            <TabsTrigger value="batches">QR batches</TabsTrigger>
            <TabsTrigger value="users">Users & roles</TabsTrigger>
            <TabsTrigger value="logs">Verification logs</TabsTrigger>
          </TabsList>

          <TabsContent value="medicines" className="mt-6">
            <Card className="border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Medicines catalog</h2>
                <NewMedicineDialog onSaved={() => qc.invalidateQueries({ queryKey: ["admin-meds"] })} />
              </div>
              <div className="divide-y">
                {meds.data?.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.generic_name ?? "—"} · {m.manufacturer ?? "—"}</div>
                    </div>
                    {m.category && <Badge variant="secondary">{m.category}</Badge>}
                  </div>
                ))}
                {meds.data?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No medicines yet.</p>}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="batches" className="mt-6">
            <Card className="border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Authentic QR batches</h2>
                <NewBatchDialog medicines={meds.data ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-batches"] })} />
              </div>
              <div className="divide-y">
                {batches.data?.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{b.medicines?.name}</div>
                      <div className="text-xs text-muted-foreground">Batch {b.batch_number} · QR <code className="rounded bg-muted px-1.5">{b.qr_code}</code></div>
                    </div>
                    <Badge variant={b.is_valid ? "secondary" : "destructive"}>{b.is_valid ? "valid" : "invalid"}</Badge>
                  </div>
                ))}
                {batches.data?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No batches yet.</p>}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card className="border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">Users & roles</h2>
              <div className="divide-y">
                {users.data?.map((u: any) => {
                  const userRoles = (roles.data ?? []).filter((r: any) => r.user_id === u.id).map((r: any) => r.role);
                  return (
                    <div key={u.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="font-medium">{u.full_name ?? u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        <div className="mt-1 flex gap-1">
                          {userRoles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>)}
                        </div>
                      </div>
                      <Select onValueChange={(v) => setRole(u.id, v as any)}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Grant role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pharmacy_staff">Pharmacy staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <Card className="border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">Recent QR verifications</h2>
              <div className="divide-y">
                {logs.data?.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between py-3 text-sm">
                    <div><code className="rounded bg-muted px-1.5">{l.qr_code}</code></div>
                    <div className="flex items-center gap-3">
                      <Badge variant={l.result === "authentic" ? "secondary" : "destructive"}>{l.result}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(l.scanned_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {logs.data?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No scans yet.</p>}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      </div>
    </Card>
  );
}

function NewMedicineDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", generic_name: "", manufacturer: "", category: "", description: "" });
  const submit = async () => {
    if (!form.name) return toast.error("Name required");
    const { error } = await supabase.from("medicines").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Medicine added");
    setOpen(false);
    setForm({ name: "", generic_name: "", manufacturer: "", category: "", description: "" });
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add medicine</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add medicine</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Generic name</Label><Input value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Analgesic" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewBatchDialog({ medicines, onSaved }: { medicines: any[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [medId, setMedId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [expiry, setExpiry] = useState("");

  const genQR = () => {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const rand2 = Math.random().toString(36).slice(2, 6).toUpperCase();
    setQrCode(`MV-${rand}-${rand2}`);
  };

  const submit = async () => {
    if (!medId || !batchNumber || !qrCode) return toast.error("Fill required fields");
    const { error } = await supabase.from("medicine_batches").insert({
      medicine_id: medId,
      batch_number: batchNumber,
      qr_code: qrCode,
      expiry_date: expiry || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Batch registered");
    setOpen(false);
    setMedId(""); setBatchNumber(""); setQrCode(""); setExpiry("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Register batch</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Register authentic batch</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Medicine *</Label>
            <Select value={medId} onValueChange={setMedId}>
              <SelectTrigger><SelectValue placeholder="Pick a medicine" /></SelectTrigger>
              <SelectContent>{medicines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Batch number *</Label><Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>QR code *</Label>
            <div className="flex gap-2">
              <Input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="MV-XXXX-XXXX" />
              <Button type="button" variant="outline" onClick={genQR}>Generate</Button>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Expiry date</Label><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
