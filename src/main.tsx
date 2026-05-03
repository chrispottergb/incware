import { Buffer } from "buffer";
(globalThis as any).Buffer = Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/v2-theme.css";

createRoot(document.getElementById("root")!).render(<App />);
