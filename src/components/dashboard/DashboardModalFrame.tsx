import type { JSX, ReactNode } from "react";
import { Modal } from "../ui";

interface DashboardModalFrameProps {
  children: ReactNode;
  maxWidthClassName: string;
}

export default function DashboardModalFrame({
  children,
  maxWidthClassName,
}: DashboardModalFrameProps): JSX.Element {
  return (
    <Modal open={true} maxWidth="md">
      <div className={maxWidthClassName}>{children}</div>
    </Modal>
  );
}
