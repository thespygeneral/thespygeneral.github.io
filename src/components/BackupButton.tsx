import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "./ui";
import { makeBackup, backupFileName, markBackedUp } from "../lib/backup";
import { downloadBlob } from "../lib/excel";
import { useJournal } from "../lib/journal";

/** Saves the whole journal as one file to the member's Downloads folder. */
export function BackupButton({ label = "Download backup file", size = "md", variant = "secondary" }: { label?: string; size?: "sm" | "md" | "lg"; variant?: "primary" | "secondary" }) {
  const { refreshBackupInfo } = useJournal();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          downloadBlob(await makeBackup(), backupFileName());
          await markBackedUp();
          await refreshBackupInfo();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {label}
    </Button>
  );
}
