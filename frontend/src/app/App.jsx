import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Router } from "./router";

export function App() {
  return (
    <ThemeProvider>
      <Router />
    </ThemeProvider>
  );
}
