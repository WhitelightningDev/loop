import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "loop_rebrand_seen_v1";

export function RebrandModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // ignore (SSR / private mode)
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? dismiss() : setOpen(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Axon is now Loop</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-center text-sm text-muted-foreground">
          <p>Same app. Same workspace. Sharper name.</p>
          <p className="text-foreground">
            Now you can just say <span className="font-medium">"I'll loop you in."</span>
          </p>
          <p className="text-xs">
            Your data, channels, and login are unchanged. Welcome to the Loop.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={dismiss} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
