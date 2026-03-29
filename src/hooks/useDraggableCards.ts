import { useState } from "react";

export interface DragItem {
  index: number;
  originalIndex: number;
}

export function useDraggableCards<T>(initialCards: T[]) {
  const [cards, setCards] = useState<T[]>(initialCards);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newCards = [...cards];
    const draggedCard = newCards[draggedIndex];
    newCards.splice(draggedIndex, 1);
    newCards.splice(index, 0, draggedCard);

    setCards(newCards);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const resetCards = (newCards: T[]) => {
    setCards(newCards);
  };

  return {
    cards,
    draggedIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetCards,
    setCards,
  };
}
