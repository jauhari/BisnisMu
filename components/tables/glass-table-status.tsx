import { defaultGlassTableFeatures } from "@/presentation/state/table-features";

export function GlassTableFeatureStatus() {
  return <div className="grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">{Object.entries(defaultGlassTableFeatures).map(([key, enabled]) => <div key={key} className="rounded-md border border-border px-2 py-1"><span className={enabled ? "text-success" : "text-danger"}>{enabled ? "On" : "Off"}</span> {key}</div>)}</div>;
}
