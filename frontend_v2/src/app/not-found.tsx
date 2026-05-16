import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="text-8xl font-bold bg-gradient-to-br from-violet-500 to-pink-500 bg-clip-text text-transparent">
          404
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="text-muted-foreground">
            This tile doesn&apos;t exist in our simulation.
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
