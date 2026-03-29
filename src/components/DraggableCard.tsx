import { motion, Reorder, useDragControls } from "framer-motion";
import { ReactNode } from "react";

interface DraggableCardProps {
  value: any;
  children: ReactNode;
  isDragging?: boolean;
}

export const DraggableCard = ({ value, children, isDragging }: DraggableCardProps) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={value}
      dragListener={true}
      dragControls={controls}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "z-50" : ""}`}
      whileDrag={{
        scale: 1.05,
        zIndex: 50,
        cursor: "grabbing",
      }}
    >
      {children}
    </Reorder.Item>
  );
};
