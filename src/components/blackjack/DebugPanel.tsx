import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestScenario, DealOverrides } from "@/lib/blackjack";

const DEALER_SCENARIOS: { value: TestScenario; label: string }[] = [
  { value: "none", label: "Random" },
  { value: "ban_luck", label: "Ban Luck (A+K)" },
  { value: "ban_ban", label: "Ban Ban (A+A)" },
  { value: "triple_sevens", label: "7-7-7" },
  { value: "ngou_leng", label: "Ngou Leng (5 cards)" },
  { value: "bust", label: "Bust (>21)" },
  { value: "fail", label: "Fail (<16)" },
  { value: "normal", label: "Normal (17)" },
];

const PLAYER_SCENARIOS: { value: TestScenario; label: string }[] = [
  { value: "none", label: "Random" },
  { value: "ban_luck", label: "Ban Luck (A+K)" },
  { value: "ban_ban", label: "Ban Ban (A+A)" },
  { value: "triple_sevens", label: "7-7-7" },
  { value: "ngou_leng", label: "Ngou Leng (5 cards)" },
  { value: "bust", label: "Bust (>21)" },
  { value: "fail", label: "Fail (<15)" },
  { value: "normal", label: "Normal (17)" },
];

interface Props {
  onGetOverrides: (overrides: DealOverrides) => void;
}

const DebugPanel = ({ onGetOverrides }: Props) => {
  const [open, setOpen] = useState(false);
  const [dealerScenario, setDealerScenario] = useState<TestScenario>("none");
  const [playerScenario, setPlayerScenario] = useState<TestScenario>("none");

  // Push overrides whenever they change
  const updateOverrides = (ds: TestScenario, ps: TestScenario) => {
    setDealerScenario(ds);
    setPlayerScenario(ps);
    onGetOverrides({ dealerScenario: ds, playerScenario: ps });
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground opacity-50 hover:opacity-100 gap-1 text-[10px]"
      >
        <Bug className="h-3 w-3" /> Debug
      </Button>
    );
  }

  return (
    <div className="w-full border border-dashed border-destructive/30 rounded-lg p-3 bg-destructive/5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-display tracking-widest text-destructive/70 uppercase">
          🧪 Playtest Panel
        </span>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-[10px] h-5 px-2 text-muted-foreground">
          Hide
        </Button>
      </div>

      {/* Dealer section */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-display tracking-wider text-muted-foreground">DEALER SCENARIO</p>
        <div className="flex flex-wrap gap-1">
          {DEALER_SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => updateOverrides(s.value, playerScenario)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                dealerScenario === s.value
                  ? "border-destructive/50 bg-destructive/10 text-foreground font-medium"
                  : "border-border/50 bg-card/50 text-muted-foreground hover:bg-card"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Player section */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-display tracking-wider text-muted-foreground">RANDOM PLAYER SCENARIO</p>
        <div className="flex flex-wrap gap-1">
          {PLAYER_SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => updateOverrides(dealerScenario, s.value)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                playerScenario === s.value
                  ? "border-destructive/50 bg-destructive/10 text-foreground font-medium"
                  : "border-border/50 bg-card/50 text-muted-foreground hover:bg-card"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;
