import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle, Package, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/pharmacy")({
  head: () => ({ meta: [{ title: "Pharmacy dashboard — MediVerify" }] }),
  component: PharmacyDashboard,
});

function PharmacyDashboard() {
  const { user, loading, isPharmacy } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const pharmaciesQuery = useQuery({
    queryKey: ["my-pharmacies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("pharmacies").select("*").eq("owner_id", user!.id);
      if (error) throw error;
      if (data.length && !selectedPharmacy) setSelectedPharmacy(data[0].id);
      return data;
    },
  });

  const inventoryQuery = useQuery({
    queryKey: ["pharm-inv", selectedPharmacy],
    enabled: !!selectedPharmacy,
    queryFn: async () => {
      const { data: invRows, error: invError } = await supabase
        .from("inventory")
        .select("*")
        .eq("pharmacy_id", selectedPharmacy!)
        .order("updated_at", { ascending: false });
      if (invError) throw invError;

      const medicineIds = Array.from(new Set((invRows ?? []).map((r: any) => r?.medicine_id).filter(Boolean))) as string[];
      const { data: meds, error: medsError } = medicineIds.length
        ? await supabase.from("medicines").select("*").in("id", medicineIds)
        : { data: [], error: null as any };
      if (medsError) throw medsError;

      const medById = new Map<string, any>((meds ?? []).map((m: any) => [m.id, m]));
      return (invRows ?? []).map((row: any) => ({
        ...row,
        medicines: medById.get(row.medicine_id) ?? null,
      }));
    },
  });

  const reservationsQuery = useQuery({
    queryKey: ["pharm-res", selectedPharmacy],
    enabled: !!selectedPharmacy,
    queryFn: async () => {
      const { data: resRows, error: resError } = await supabase
        .from("reservations")
        .select("*")
        .eq("pharmacy_id", selectedPharmacy!)
        .order("created_at", { ascending: false });
      if (resError) throw resError;

      const medicineIds = Array.from(new Set((resRows ?? []).map((r: any) => r?.medicine_id).filter(Boolean))) as string[];
      const userIds = Array.from(new Set((resRows ?? []).map((r: any) => r?.user_id).filter(Boolean))) as string[];

      const [{ data: meds, error: medsError }, { data: profs, error: profError }] = await Promise.all([
        medicineIds.length ? supabase.from("medicines").select("id,name").in("id", medicineIds) : Promise.resolve({ data: [], error: null as any }),
        userIds.length ? supabase.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [], error: null as any }),
      ]);
      if (medsError) throw medsError;
      if (profError) throw profError;

      const medById = new Map<string, any>((meds ?? []).map((m: any) => [m.id, m]));
      const profById = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

      return (resRows ?? []).map((r: any) => ({
        ...r,
        medicines: medById.get(r.medicine_id) ?? null,
        profiles: profById.get(r.user_id) ?? null,
      }));
    },
  });

  const medsQuery = useQuery({
    queryKey: ["all-meds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("medicines").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const lowStock = (inventoryQuery.data ?? []).filter((i: any) => i.quantity <= i.low_stock_threshold);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-soft">
      <SiteHeader />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pharmacy dashboard</h1>
            <p className="mt-1 text-muted-foreground">Manage inventory, reservations, and stock alerts.</p>
          </div>
          <div className="flex gap-2">
            {pharmaciesQuery.data && pharmaciesQuery.data.length > 0 && (
              <Select value={selectedPharmacy ?? undefined} onValueChange={setSelectedPharmacy}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select pharmacy" /></SelectTrigger>
                <SelectContent>
                  {pharmaciesQuery.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <NewPharmacyDialog onCreated={() => qc.invalidateQueries({ queryKey: ["my-pharmacies"] })} />
          </div>
        </div>

        {!isPharmacy && (
          <Card className="mb-6 border-warning/40 bg-warning/10 p-4 text-sm">
            <strong>Heads up:</strong> You don't have the pharmacy_staff role yet. You can still register a pharmacy below — an admin can grant you the role to unlock more features.
          </Card>
        )}

        {pharmaciesQuery.data?.length === 0 ? (
          <Card className="border bg-card p-12 text-center">
            <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No pharmacy yet</h3>
            <p className="mb-4 text-muted-foreground">Register your pharmacy to start managing inventory.</p>
            <NewPharmacyDialog onCreated={() => qc.invalidateQueries({ queryKey: ["my-pharmacies"] })} />
          </Card>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <StatCard label="SKUs in stock" value={inventoryQuery.data?.length ?? 0} icon={Package} tone="primary" />
              <StatCard label="Low stock alerts" value={lowStock.length} icon={AlertTriangle} tone={lowStock.length ? "warning" : "muted"} />
              <StatCard label="Open reservations" value={(reservationsQuery.data ?? []).filter((r: any) => r.status === "pending").length} icon={Building2} tone="primary" />
            </div>

            {lowStock.length > 0 && (
              <Card className="mb-6 border-warning/40 bg-warning/10 p-5">
                <div className="mb-3 flex items-center gap-2 font-semibold text-warning-foreground">
                  <AlertTriangle className="h-5 w-5 text-warning" /> Low stock alerts
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lowStock.map((i: any) => (
                    <li key={i.id} className="flex items-center justify-between rounded-md bg-background/60 px-3 py-2 text-sm">
                      <span className="font-medium">{i.medicines?.name}</span>
                      <Badge variant="outline" className="border-warning text-warning-foreground">{i.quantity} left</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <Card className="border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Inventory</h2>
                  <AddInventoryDialog
                    pharmacyId={selectedPharmacy!}
                    medicines={medsQuery.data ?? []}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["pharm-inv"] })}
                  />
                </div>
                <div className="divide-y">
                  {(inventoryQuery.data ?? []).length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No inventory yet.</p>
                  )}
                  {inventoryQuery.data?.map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="font-medium">{i.medicines?.name}</div>
                        <div className="text-xs text-muted-foreground">{i.medicines?.generic_name ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`font-medium ${i.quantity <= i.low_stock_threshold ? "text-warning" : "text-success"}`}>{i.quantity}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold">${Number(i.price).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">Recent reservations</h2>
                <div className="space-y-3">
                  {(reservationsQuery.data ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No reservations yet.</p>
                  )}
                  {reservationsQuery.data?.slice(0, 8).map((r: any) => (
                    <div key={r.id} className="rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{r.medicines?.name}</div>
                        <Badge variant={r.status === "pending" ? "secondary" : "outline"}>{r.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.profiles?.full_name ?? r.profiles?.email ?? "Customer"} · qty {r.quantity}
                      </div>
                      {r.status === "pending" && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={async () => {
                            await supabase.from("reservations").update({ status: "ready" }).eq("id", r.id);
                            qc.invalidateQueries({ queryKey: ["pharm-res"] });
                          }}>Mark ready</Button>
                          <Button size="sm" variant="ghost" onClick={async () => {
                            await supabase.from("reservations").update({ status: "cancelled" }).eq("id", r.id);
                            qc.invalidateQueries({ queryKey: ["pharm-res"] });
                          }}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "primary" | "warning" | "muted" }) {
  const toneCls = tone === "warning" ? "bg-warning/15 text-warning" : tone === "muted" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary";
  return (
    <Card className="border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${toneCls}`}><Icon className="h-5 w-5" /></div>
      </div>
    </Card>
  );
}

function NewPharmacyDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", phone: "" });
  const submit = async () => {
    if (!user || !form.name || !form.address || !form.city) return toast.error("Fill required fields");
    const { error } = await supabase.from("pharmacies").insert({ ...form, owner_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Pharmacy registered");
    setOpen(false); setForm({ name: "", address: "", city: "", phone: "" });
    onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add pharmacy</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Register pharmacy</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Address *</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>City *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddInventoryDialog({ pharmacyId, medicines, onSaved }: { pharmacyId: string; medicines: any[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [medId, setMedId] = useState<string>("");
  const [qty, setQty] = useState("0");
  const [price, setPrice] = useState("0");
  const [threshold, setThreshold] = useState("10");

  const submit = async () => {
    if (!medId) return toast.error("Pick a medicine");
    const { error } = await supabase.from("inventory").upsert({
      pharmacy_id: pharmacyId,
      medicine_id: medId,
      quantity: Number(qty),
      price: Number(price),
      low_stock_threshold: Number(threshold),
      updated_at: new Date().toISOString(),
    }, { onConflict: "pharmacy_id,medicine_id" });
    if (error) return toast.error(error.message);
    toast.success("Inventory updated");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />Add / update</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Update inventory</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Medicine</Label>
            <Select value={medId} onValueChange={setMedId}>
              <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
              <SelectContent>{medicines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Price</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Low alert</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
