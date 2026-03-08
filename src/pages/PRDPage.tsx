import { motion } from "framer-motion";
import { FileText, Download, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { websitePRD, gamePRDs, type PRDDocument } from "@/lib/prdData";
import { downloadPRDAsDocx } from "@/lib/generateDocx";
import { useState } from "react";

const PRDCard = ({ prd, index }: { prd: PRDDocument; index: number }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPRDAsDocx(prd);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Card className="group hover:border-primary/40 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-lg">{prd.title}</CardTitle>
            </div>
          </div>
          <CardDescription className="text-sm">{prd.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {prd.sections.slice(0, 3).map((s) => (
              <p key={s.title} className="text-xs text-muted-foreground truncate">
                {s.title}
              </p>
            ))}
            {prd.sections.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{prd.sections.length - 3} more sections
              </p>
            )}
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full gap-2 font-display tracking-wider text-sm"
            variant="outline"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Generating…" : "Download .docx"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const PRDPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30">
        <div className="container mx-auto px-4 py-6 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-wider text-glow">
              Product Requirements
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Download PRDs for the platform and each game
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
        {/* Website PRD */}
        <section>
          <h2 className="text-lg font-display font-bold tracking-wider text-muted-foreground mb-4">
            PLATFORM
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <PRDCard prd={websitePRD} index={0} />
          </div>
        </section>

        {/* Game PRDs */}
        <section>
          <h2 className="text-lg font-display font-bold tracking-wider text-muted-foreground mb-4">
            GAMES
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {gamePRDs.map((prd, i) => (
              <PRDCard key={prd.id} prd={prd} index={i + 1} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default PRDPage;
