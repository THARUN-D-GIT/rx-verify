import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";





export default function SearchPage() {
  const [search, setSearch] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<any>(null);

  const medicinesQuery = useQuery({
    queryKey: ["medicines", search],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicines")
        .select("*")
        .ilike("name", `%${search}%`)
        .limit(20);

      if (error) throw error;

      return data ?? [];
    },
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", selectedMedicine?.id],
    enabled: !!selectedMedicine?.id,
  
    queryFn: async () => {
      if (!selectedMedicine?.id) {
        return [];
      }
  
      console.log("SELECTED MEDICINE ID:", selectedMedicine.id);
  
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("medicine_id", String(selectedMedicine.id));
  
      console.log("INVENTORY DATA:", data);
      console.log("INVENTORY ERROR:", error);
  
      if (error) {
        console.error(error);
        return [];
      }
      console.log("🔥 NEW SEARCH PAGE RUNNING");
console.log("SELECTED MEDICINE:", selectedMedicine);
  
      return data || [];
    },
  });

     

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-2">
          <div className="text-sm font-medium tracking-wide text-slate-500">
            Medicine Search
          </div>
          <div className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
            Find medicines and check availability
          </div>
          <div className="text-sm leading-relaxed text-slate-600">
            Search by medicine name, then select a result to view pharmacy availability, quantity, and pricing.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* LEFT SIDE */}
        <div>
          <div className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-5">
            <label className="block text-sm font-medium text-slate-700">
              Search medicines
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M10.5 18C14.6421 18 18 14.6421 18 10.5C18 6.35786 14.6421 3 10.5 3C6.35786 3 3 6.35786 3 10.5C3 14.6421 6.35786 18 10.5 18Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 21L16.65 16.65"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search medicines..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-10 pr-3 text-slate-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 transition focus:border-sky-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(14,165,233,0.12)]"
                aria-label="Search medicines"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div>
                {medicinesQuery.isLoading ? (
                  <span>Searching…</span>
                ) : medicinesQuery.error ? (
                  <span className="text-rose-600">Search error</span>
                ) : (
                  <span>
                    Showing{" "}
                    <span className="font-medium text-slate-700">
                      {(medicinesQuery.data ?? []).length}
                    </span>{" "}
                    results
                  </span>
                )}
              </div>
              <div className="hidden sm:block">
                Tip: Try partial names (e.g. “para”, “amoxi”)
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {medicinesQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl"
                    aria-hidden="true"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                      </div>
                      <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : medicinesQuery.error ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm text-rose-700 shadow-sm backdrop-blur">
                Something went wrong while searching. Please try again.
              </div>
            ) : (medicinesQuery.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-600 shadow-sm backdrop-blur">
                {search.trim().length === 0 ? (
                  <div>Start typing to search medicines.</div>
                ) : (
                  <div>
                    No medicines found for{" "}
                    <span className="font-medium text-slate-800">
                      “{search}”
                    </span>
                    .
                  </div>
                )}
              </div>
            ) : (
              (medicinesQuery.data ?? []).map((medicine: any) => {
                const isSelected = selectedMedicine?.id === medicine.id;
                const category =
                  medicine.category ??
                  medicine.type ??
                  medicine.drug_class ??
                  medicine.form ??
                  "Medicine";

                return (
                  <div
                    key={medicine.id}
                    onClick={() => setSelectedMedicine(medicine)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedMedicine(medicine);
                      }
                    }}
                    className={[
                      "group cursor-pointer rounded-2xl border p-4 shadow-[0_12px_35px_-22px_rgba(15,23,42,0.35)] backdrop-blur-xl transition",
                      "hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white/80 hover:shadow-[0_18px_45px_-24px_rgba(15,23,42,0.45)]",
                      "focus:outline-none focus:ring-4 focus:ring-sky-100",
                      isSelected
                        ? "border-sky-200 bg-white/80 ring-4 ring-sky-100"
                        : "border-white/60 bg-white/60",
                    ].join(" ")}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-900">
                          {medicine.name}
                        </div>

                        <div className="mt-1 truncate text-sm text-slate-600">
                          {medicine.manufacturer}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition group-hover:border-sky-200 group-hover:text-slate-900">
                          {String(category)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        Click to view availability
                      </div>
                      <div className="text-xs font-medium text-sky-700 opacity-0 transition group-hover:opacity-100">
                        View details →
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="md:sticky md:top-6 md:self-start">
          {selectedMedicine ? (
            <div className="rounded-2xl border border-white/60 bg-white/60 p-5 shadow-[0_18px_55px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-1">
                <div className="text-xs font-medium tracking-wide text-slate-500">
                  Selected medicine
                </div>
                <div className="text-xl font-semibold leading-tight text-slate-900">
                  {selectedMedicine.name}
                </div>
                <div className="text-sm text-slate-600">
                  {selectedMedicine.manufacturer}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    Availability
                  </div>
                  <div className="text-xs text-slate-500">
                    {inventoryQuery.isLoading ? (
                      <span>Loading…</span>
                    ) : inventoryQuery.error ? (
                      <span className="text-rose-600">Error</span>
                    ) : (
                      <span>{(inventoryQuery.data ?? []).length} pharmacies</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-3">

                  {inventoryQuery.isLoading ? (
                    <div className="space-y-3" aria-label="Loading availability">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur"
                          aria-hidden="true"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200" />
                              <div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-slate-200" />
                            </div>
                            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="h-8 animate-pulse rounded-xl bg-slate-200" />
                            <div className="h-8 animate-pulse rounded-xl bg-slate-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : inventoryQuery.data &&
                    inventoryQuery.data.length > 0 ? (

                    inventoryQuery.data.map((item: any) => (
                      (() => {
                        const qty = Number(item.quantity ?? 0);
                        const inStock = qty > 0;
                        return (
                      <div
                        key={item.id}
                        className="group rounded-2xl border border-white/60 bg-white/60 p-4 shadow-[0_12px_35px_-22px_rgba(15,23,42,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white/75 hover:shadow-[0_18px_45px_-24px_rgba(15,23,42,0.45)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {item?.pharmacy?.name ? (
                                item.pharmacy.name
                              ) : (
                                <span>Pharmacy ID: {item.pharmacy_id}</span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item?.pharmacy?.city ?? "City unavailable"}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {inStock ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                                In Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 shadow-sm">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                            <div className="text-[11px] font-medium text-slate-500">
                              Quantity
                            </div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-900">
                              {qty}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                            <div className="text-[11px] font-medium text-slate-500">
                              Price
                            </div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-900">
                              ₹{item.price}
                            </div>
                          </div>
                        </div>
                      </div>
                        );
                      })()
                    ))

                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-600 shadow-sm backdrop-blur">
                      No pharmacies currently list this medicine.
                    </div>
                  )}

                </div>
              </div>

            </div>
          ) : (
            <div className="rounded-2xl border border-white/60 bg-white/60 p-6 text-slate-600 shadow-[0_18px_55px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <div className="text-sm font-semibold text-slate-900">
                No medicine selected
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Select a medicine from the left to view pharmacy availability.
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-4 text-xs text-slate-500">
                The details panel stays in view as you scroll on larger screens.
              </div>
            </div>
          )}
        </div>

      </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/search")({
component: SearchPage,
});