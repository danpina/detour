export type CardResult = { correct?: boolean };

export type CardViewProps<C> = {
  card: C;
  index: number;
  total: number;
  /** Call once when the user has engaged with the card (revealed, answered, finished). */
  onComplete: (result?: CardResult) => void;
  /** Move to the next card. */
  onNext: () => void;
  completed: boolean;
};
