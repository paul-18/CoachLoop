import React from "react";
import { createRoot } from "react-dom/client";
import "./app/globals.css";
import { AppErrorBoundary } from "./app/views/app-error-boundary";
import CoachLoop from "./app/workout-app";

// Older iOS standalone sessions can report a zero inset during launch.
const standaloneQuery = window.matchMedia("(display-mode: standalone)");
const syncStandalone = () => { document.documentElement.dataset.appStandalone = String(standaloneQuery.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true); };
syncStandalone();
standaloneQuery.addEventListener("change", syncStandalone);

createRoot(document.getElementById("root")!).render(<React.StrictMode><AppErrorBoundary><CoachLoop /></AppErrorBoundary></React.StrictMode>);
