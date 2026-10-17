import { Component, type ReactNode } from "react";

type State = { failed: boolean };

/** Last-resort screen so a crash never leaves a blank page. Progress is stored locally and is not affected. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Detour crashed", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50 px-8 text-center text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <h1 className="text-2xl font-semibold">Hmm, that didn't work</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Your progress is safe on this device. Let's try again.</p>
        <button onClick={() => location.reload()} className="mt-2 rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">
          Reload
        </button>
      </div>
    );
  }
}
