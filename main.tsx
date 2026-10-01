import React from "react";
import { createRoot } from "react-dom/client";
import "./app/globals.css";
import CoachLoop from "./app/workout-app";

createRoot(document.getElementById("root")!).render(<React.StrictMode><CoachLoop /></React.StrictMode>);
