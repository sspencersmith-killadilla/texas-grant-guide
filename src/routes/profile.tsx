import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, CATEGORY_LABELS, type GrantCategory } from "@/lib/grants/types";
import {
  clearProfile,
  DESIGNATION_OPTIONS,
  EMPTY_PROFILE,
  FRONT_COSTS_LABELS,
  loadProfile,
  MATCH_CAPACITY_LABELS,
  saveProfile,
  SERVICE_OPTIONS,
  STAFF_CAPACITY_LABELS,
  type CityProfile,
  type FrontCosts,
  type MatchCapacity,
  type StaffCapacity,
} from "@/lib/city-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your city profile | Texas Municipal Grant Finder" },
      {
        name: "description",
        content:
          "Tell us about your city once and every grant gets scored for fit, with drafts pre-filled from your population, services and match capacity.",
      },
      { property: "og:title", content: "Your city profile" },
      {
        property: "og:description",
        content: "Set up your city once to get fit-scored grant matches and better first-draft applications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile] = useState<CityProfile>(EMPTY_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [keywordText, setKeywordText] = useState("");

  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setProfile(existing);
      setKeywordText(existing.keywords.join(", "));
    }
    setHydrated(true);
  }, []);

  const set = <K extends keyof CityProfile>(key: K, value: CityProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const toggle = (key: "services" | "designations" | "priorities", id: string) =>
    setProfile((p) => {
      const list = p[key] as string[];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...p, [key]: next } as CityProfile;
    });

  const handleSave = () => {
    if (!profile.cityName.trim()) {
      toast.error("Add your city name so we can score grants for you.");
      return;
    }
    const keywords = keywordText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 20);
    setProfile(saveProfile({ ...profile, keywords }));
    toast.success("Profile saved. Every grant is now scored for your city.");
  };

  if (!hydrated) {
    return (
      <Shell>
        <div className="h-96 animate-pulse border border-border bg-card" />
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="border border-border bg-card p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Set up once</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
          <Building2 className="size-5 text-accent" /> Your city profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          This never leaves your browser. It is used to score every grant for fit, warn you about programs your city
          cannot win, and pre-fill your draft applications so you are not retyping the same facts.
        </p>
      </header>

      <div className="mt-6 space-y-6">
        <Section title="The basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City name">
              <Input
                value={profile.cityName}
                onChange={(e) => set("cityName", e.target.value)}
                placeholder="City of Bastrop"
                className="rounded-sm"
              />
            </Field>
            <Field label="County">
              <Input
                value={profile.county}
                onChange={(e) => set("county", e.target.value)}
                placeholder="Bastrop"
                className="rounded-sm"
              />
            </Field>
            <Field label="Population" hint="Used to catch programs capped by community size.">
              <Input
                type="number"
                inputMode="numeric"
                value={profile.population ?? ""}
                onChange={(e) => set("population", e.target.value ? Number(e.target.value) : null)}
                placeholder="10500"
                className="rounded-sm"
              />
            </Field>
            <Field label="Governance">
              <div className="flex gap-2">
                {(
                  [
                    ["general-law", "General-law city"],
                    ["home-rule", "Home-rule city"],
                  ] as const
                ).map(([value, label]) => (
                  <Chip
                    key={value}
                    active={profile.governance === value}
                    onClick={() => set("governance", profile.governance === value ? "" : value)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
          <Field
            label="SAM.gov UEI (optional)"
            hint="Federal awards require an active SAM.gov registration. Leave blank if you do not have one yet."
          >
            <Input
              value={profile.uei}
              onChange={(e) => set("uei", e.target.value)}
              placeholder="ABC1DEF2GHI3"
              className="max-w-xs rounded-sm"
            />
          </Field>
        </Section>

        <Section title="What your city runs" hint="A grant that funds something you do not operate is rarely worth the effort.">
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICE_OPTIONS.map((option) => (
              <CheckRow
                key={option.id}
                checked={profile.services.includes(option.id)}
                onChange={() => toggle("services", option.id)}
                label={option.label}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Designations that unlock funding"
          hint="These are the labels funders use to target money. Checking the ones that apply surfaces set-aside programs you would otherwise scroll past."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {DESIGNATION_OPTIONS.map((option) => (
              <CheckRow
                key={option.id}
                checked={profile.designations.includes(option.id)}
                onChange={() => toggle("designations", option.id)}
                label={option.label}
              />
            ))}
          </div>
        </Section>

        <Section title="What you are trying to fund">
          <Field label="Priority categories">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c: GrantCategory) => (
                <Chip
                  key={c}
                  active={profile.priorities.includes(c)}
                  onClick={() => toggle("priorities", c)}
                >
                  {CATEGORY_LABELS[c]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field
            label="Capital projects and known needs"
            hint="Plain sentences are fine. This gets woven into your draft applications, so the more specific the better."
          >
            <Textarea
              value={profile.capitalProjects}
              onChange={(e) => set("capitalProjects", e.target.value)}
              rows={4}
              placeholder="Replace the Water Street lift station, resurface 4 miles of collector streets, add a splash pad at Fisherman's Park, expand library hours."
              className="rounded-sm"
            />
          </Field>
          <Field
            label="Watchlist keywords"
            hint="Comma separated. Any grant mentioning these gets pushed to the top — useful for narrow needs like 'lead service line' or 'wildfire'."
          >
            <Input
              value={keywordText}
              onChange={(e) => setKeywordText(e.target.value)}
              placeholder="lift station, lead service line, splash pad, bookmobile"
              className="rounded-sm"
            />
          </Field>
        </Section>

        <Section title="What you can realistically take on">
          <Field label="Local match you could commit">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MATCH_CAPACITY_LABELS) as Exclude<MatchCapacity, "">[]).map((value) => (
                <Chip
                  key={value}
                  active={profile.matchCapacity === value}
                  onClick={() => set("matchCapacity", profile.matchCapacity === value ? "" : value)}
                >
                  {MATCH_CAPACITY_LABELS[value]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Who handles grants">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STAFF_CAPACITY_LABELS) as Exclude<StaffCapacity, "">[]).map((value) => (
                <Chip
                  key={value}
                  active={profile.staffCapacity === value}
                  onClick={() => set("staffCapacity", profile.staffCapacity === value ? "" : value)}
                >
                  {STAFF_CAPACITY_LABELS[value]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Can you pay first and get reimbursed?" hint="Most federal awards reimburse after you spend.">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FRONT_COSTS_LABELS) as Exclude<FrontCosts, "">[]).map((value) => (
                <Chip
                  key={value}
                  active={profile.canFrontCosts === value}
                  onClick={() => set("canFrontCosts", profile.canFrontCosts === value ? "" : value)}
                >
                  {FRONT_COSTS_LABELS[value]}
                </Chip>
              ))}
            </div>
          </Field>
        </Section>

        <div className="flex flex-wrap items-center gap-3 border border-border bg-surface p-5">
          <Button className="rounded-sm bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSave}>
            <Check className="size-4" /> Save profile
          </Button>
          <Button asChild variant="outline" className="rounded-sm">
            <Link to="/">See my matched grants</Link>
          </Button>
          <Button
            variant="ghost"
            className="ml-auto rounded-sm text-muted-foreground hover:text-urgent"
            onClick={() => {
              clearProfile();
              setProfile(EMPTY_PROFILE);
              setKeywordText("");
              toast.success("Profile cleared from this browser.");
            }}
          >
            <Trash2 className="size-4" /> Clear
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</Label>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 border border-border bg-background px-3 py-2 text-sm hover:border-accent/50">
      <Checkbox checked={checked} onCheckedChange={onChange} className="rounded-[2px]" />
      {label}
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
