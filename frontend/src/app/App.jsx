import { LandingPage } from "../pages/LandingPage";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

export function App() {
  return (
    <ThemeProvider>
      <LandingPage />
    </ThemeProvider>
  );
}
