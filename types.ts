
export enum CategoryType {
  UNIVERSAL = 'Bộ bài Tổng hợp (All-in-One)',
}

export interface Card {
  id: string;
  title: string;
  content: string;
  penalty: string;
  category: CategoryType;
}

export interface GameState {
  currentDeck: Card[];
  discardPile: Card[];
  currentCard: Card | null;
  selectedCategory: CategoryType | null;
}
