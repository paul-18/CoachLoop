import React from "react";
import { createRoot } from "react-dom/client";
import "./app/globals.css";
import { AppErrorBoundary } from "./app/views/app-error-boundary";
import CoachLoop from "./app/workout-app";

createRoot(document.getElementById("root")!).render(<React.StrictMode><AppErrorBoundary><CoachLoop /></AppErrorBoundary></React.StrictMode>);
