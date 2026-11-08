import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "@/components/base/toast/toast";
import { UpdateDialog } from "@/ui/update-dialog";
import { watchTheme } from "@/ui/theme-sync";

interface UpdateInfo {
  message: string;
  releaseUrl: string;
}

declare global {
  interface Window {
    mesaUI?: {
      toast: typeof toast;
      openUpdateDialog: (info: UpdateInfo) => void;
    };
  }
}

let showUpdate: (info: UpdateInfo) => void = () => {};

window.mesaUI = {
  toast,
  openUpdateDialog: (info) => showUpdate(info),
};

function App() {
  const [dialog, setDialog] = useState({ open: false, message: "", releaseUrl: "" });

  useEffect(() => {
    showUpdate = (info) => setDialog({ open: true, ...info });
  }, []);

  return (
    <>
      <Toaster position="bottom-end" aria-label="Avisos" closeLabel="Fechar" />
      <UpdateDialog
        open={dialog.open}
        message={dialog.message}
        releaseUrl={dialog.releaseUrl}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
    </>
  );
}

const mountNode = document.createElement("div");
mountNode.id = "mesa-react";
document.body.append(mountNode);

watchTheme(document.documentElement);
createRoot(mountNode).render(<App />);
