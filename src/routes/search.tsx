import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, MapPin, Pill, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search medicines — MediVerify" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [selectedMed, setSelectedMed] = useState<string | null>(null);
  const { user } = useAuth();

  const medsQuery = useQuery({
    queryKey: ["meds", q],
    queryFn: async () => {
      let req = supabase.from("medicines").select("*").order("name").limit(50);
      if (q.trim()) req = req.or(`name.ilike.%${q}%,generic_name.ilike.%${q}%,manufacturer.ilike.%${q}%`);
      const { data, error } = await req;
      if (error) throw error;
      return data;
    },
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", selectedMed],
    enabled: !!selectedMed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_inventory")
        .select("*, pharmacies(*)")
        .eq("medicine_id", selectedMed!)
        .gt("quantity", 0);
      if (error) throw error;
      return data;
    },
  });

  const reserve = async (pharmacyId: string) => {
    if (!user) return toast.error("Please sign in to reserve");
    if (!selectedMed) return;
    const { error } = await supabase.from("reservations").insert({
      user_id: user.id,
      pharmacy_id: pharmacyId,
      medicine_id: selectedMed,
      quantity: 1,
      status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Reservation placed");
  };

  return (
    <div className="min-h-screen bg-soft">
      <SiteHeader />

      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Find a medicine</h1>
          <p className="mt-1 text-muted-foreground">Search by brand, generic name, or manufacturer.</p>
        </div>

        <div className="relative mb-8 max-w-2xl">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="e.g. Paracetamol, Amoxicillin..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 pl-11 text-base shadow-card"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card className="border bg-card p-2">
            <div className="border-b px-4 py-3 text-sm font-medium text-muted-foreground">
              {medsQuery.isLoading ? "Loading..." : `${medsQuery.data?.length ?? 0} medicines`}
            </div>
            <div className="max-h-[600px] divide-y overflow-y-auto">
              {medsQuery.data?.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No medicines yet. An admin can add them.</div>
              )}
              {medsQuery.data?.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMed(m.id)}
                  className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent ${selectedMed === m.id ? "bg-accent" : ""}`}
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-hero text-primary-foreground">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.generic_name ?? "—"} · {m.manufacturer ?? "—"}
                    </div>
                  </div>
                  {m.category && <Badge variant="secondary">{m.category}</Badge>}
                </button>
              ))}
            </div>
          </Card>

          <Card className="border bg-card p-6">
            {!selectedMed ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
                <Package className="mb-3 h-10 w-10 text-muted-foreground/60" />
                <p>Select a medicine to see nearby availability.</p>
              </div>
            ) : (
              <>
                <h2 className="mb-4 text-lg font-semibold">Nearby pharmacy availability</h2>
                {inventoryQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                {inventoryQuery.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No pharmacy currently has this medicine in stock.</p>
                )}
                <div className="space-y-3">
                  {inventoryQuery.data?.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border bg-background/60 p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          <MapPin className="h-4 w-4 text-primary" />
                          {inv.pharmacies?.name}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {inv.pharmacies?.address}, {inv.pharmacies?.city}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-xs">
                          <span className="font-medium text-success">{inv.quantity} in stock</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-semibold text-foreground">${Number(inv.price).toFixed(2)}</span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => reserve(inv.pharmacy_id)}>Reserve</Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
