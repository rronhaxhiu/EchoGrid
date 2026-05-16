import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function GlassActionCard({ accent, title, description, action }) {
  return (
    <Card className="group min-h-72 border-white/16 bg-slate-950/42 shadow-2xl shadow-black/25 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/28 hover:bg-slate-900/54">
      <CardContent className="flex h-full flex-col items-center justify-between p-7 text-center">
        <div>
          <div
            className="mx-auto grid size-20 place-items-center rounded-full border text-2xl font-semibold shadow-[0_0_48px_rgba(125,211,252,0.18)]"
            style={{
              borderColor: accent.border,
              backgroundColor: accent.background,
              color: accent.text,
            }}
          >
            {action}
          </div>
          <h2 className="mt-7 text-xl font-semibold text-white">{title}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-200/72">{description}</p>
        </div>
        <Button className="mt-6" variant="glass">
          Open
        </Button>
      </CardContent>
    </Card>
  );
}
