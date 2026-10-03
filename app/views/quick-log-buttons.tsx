import { Backpack, Bike, RotateCcw, Waves } from "lucide-react";
import { DEFAULT_QUICK_LOG_ACTIVITIES, QUICK_LOG_OPTIONS, type AppSettings, type QuickLogActivityType } from "../domain/training-types";
import { GrapplingIcon, RunningIcon, SoccerBallIcon, SwimmingIcon, YogaIcon } from "./sport-icons";

const icons = { run: RunningIcon, swim: SwimmingIcon, bike: Bike, ruck: Backpack, circuit: RotateCcw, soccer: SoccerBallIcon, grappling: GrapplingIcon, yoga: YogaIcon, water_polo: Waves };
export function QuickLogButtons({ settings, disabled, onChoose }: { settings: AppSettings; disabled: boolean; onChoose: (type: QuickLogActivityType) => void }) {
  const selected = settings.quickLogActivities ?? DEFAULT_QUICK_LOG_ACTIVITIES;
  return <div className="quick-grid">{selected.map(type => {
    const option = QUICK_LOG_OPTIONS.find(option => option.type === type);
    if (!option) return null;
    const Icon = icons[type];
    return <button type="button" key={type} onClick={() => onChoose(type)} disabled={disabled}><Icon /><span>{option.label}</span></button>;
  })}{!selected.length && <p className="col-span-full text-sm text-white/60">Choose your quick-log activities in Settings → Appearance & quick log.</p>}</div>;
}
