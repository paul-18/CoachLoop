import { QUICK_LOG_OPTIONS, type QuickLogActivityType } from "./training-types";
export function orderedQuickLogOptions(selected: QuickLogActivityType[]) {
  return [...selected.map(type => QUICK_LOG_OPTIONS.find(option => option.type === type)!).filter(Boolean), ...QUICK_LOG_OPTIONS.filter(option => !selected.includes(option.type))];
}
