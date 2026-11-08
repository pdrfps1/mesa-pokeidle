import { Button } from "@/components/base/buttons/button";
import {
  Modal,
  ModalBody,
  ModalDialog,
  ModalFooter,
  ModalHeader,
} from "@/components/base/modal/modal";

declare global {
  interface Window {
    mesa?: {
      openExternal?: (url: string) => void;
    };
  }
}

export interface UpdateDialogProps {
  open: boolean;
  message: string;
  releaseUrl: string;
  onOpenChange: (open: boolean) => void;
}

export function UpdateDialog({ open, message, releaseUrl, onOpenChange }: UpdateDialogProps) {
  const close = () => onOpenChange(false);

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange} size="sm">
      <ModalDialog>
        <ModalHeader title="Nova versão disponível" closeLabel="Fechar" />
        <ModalBody>
          <p>{message}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={close}>
            Agora não
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              window.mesa?.openExternal?.(releaseUrl);
              close();
            }}
          >
            Abrir página da release
          </Button>
        </ModalFooter>
      </ModalDialog>
    </Modal>
  );
}
