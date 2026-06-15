import { Component, type ReactNode } from "react";

/**
 * Isolates a non-critical subtree (visual effects) so a render/runtime error in
 * it cannot crash the whole app — most importantly, it must never take down the
 * voice/wake-word handling that lives elsewhere in the tree.
 */
export class SafeBoundary extends Component<{ name?: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[SafeBoundary${this.props.name ? ` ${this.props.name}` : ""}] caught:`, error);
  }

  render() {
    if (this.state.failed) return null; // silently drop the broken effect
    return this.props.children;
  }
}
