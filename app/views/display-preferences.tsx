import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppSettings } from "../domain/training-types";
import { COLOR_THEMES, DEFAULT_PROGRESS_SECTIONS, DEFAULT_WEEKLY_CARDS, PROGRESS_SECTION_OPTIONS, WEEKLY_CARD_OPTIONS, toggleChoice } from "../domain/display-preferences";
export type UpdateSettings = (update: (settings: AppSettings) => AppSettings) => void;

export function DisplayPreferences({ settings, onUpdate, showColors = true }: { settings: AppSettings; onUpdate: UpdateSettings; showColors?: boolean }) {
  const weekly = settings.weeklyCards ?? DEFAULT_WEEKLY_CARDS;
  const sections = settings.progressSections ?? DEFAULT_PROGRESS_SECTIONS;
  return <div className="display-preferences space-y-6">
    {showColors && <fieldset><legend className="font-bold">App accent color</legend><p className="mt-1 text-sm text-white/60">Keep the dark background and choose your accent.</p><div className="theme-options">{COLOR_THEMES.map(theme => <button type="button" key={theme.id} aria-pressed={(settings.colorTheme ?? "lime") === theme.id} onClick={() => onUpdate(current => ({ ...current, colorTheme: theme.id }))}><i style={{ background: theme.color }} /><span>{theme.label}</span><span aria-hidden="true">{(settings.colorTheme ?? "lime") === theme.id ? "✓" : ""}</span></button>)}</div></fieldset>}
    <fieldset><legend className="font-bold">Last 7 days cards</legend><p className="mt-1 text-sm text-white/60">Choose one, two, or as many as you want. These choices are independent of your quick-log buttons.</p><div className="display-choice-grid">{WEEKLY_CARD_OPTIONS.map(option => <label key={option.id}><Checkbox checked={weekly.includes(option.id)} onCheckedChange={checked => onUpdate(current => ({ ...current, weeklyCards: toggleChoice(current.weeklyCards ?? DEFAULT_WEEKLY_CARDS, option.id, checked === true) }))} />{option.label}</label>)}</div><Button variant="ghost" className="mt-2" onClick={() => onUpdate(current => ({ ...current, weeklyCards: [...DEFAULT_WEEKLY_CARDS] }))}>Restore default cards</Button></fieldset>
    <fieldset><legend className="font-bold">Progress sections</legend><p className="mt-1 text-sm text-white/60">Hide sections you don’t use. Your data and calculations stay saved.</p><div className="display-choice-grid">{PROGRESS_SECTION_OPTIONS.map(option => <label key={option.id}><Checkbox checked={sections.includes(option.id)} onCheckedChange={checked => onUpdate(current => ({ ...current, progressSections: toggleChoice(current.progressSections ?? DEFAULT_PROGRESS_SECTIONS, option.id, checked === true) }))} />{option.label}</label>)}</div><Button variant="ghost" className="mt-2" onClick={() => onUpdate(current => ({ ...current, progressSections: [...DEFAULT_PROGRESS_SECTIONS] }))}>Show all sections</Button></fieldset>
  </div>;
}
