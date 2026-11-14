import { LoadingIndicator } from './loading/LoadingIndicator';
import { StateLayout } from './loading/StateLayout';

interface Props {
  message?: string;
  /** Quieter second line, e.g. what is being fetched. */
  subtitle?: string;
  /** Centre in the parent instead of filling the screen. */
  inline?: boolean;
}

/**
 * Full-screen loading state with the M3 Expressive contained loading
 * indicator, after the Paisa and Patchwork loaders. Keeps the old
 * `message` prop so every screen picks it up unchanged.
 */
export function LoadingState({ message, subtitle, inline = false }: Props) {
  return (
    <StateLayout
      fullScreen={!inline}
      visual={<LoadingIndicator size={inline ? 72 : 96} accessibilityLabel={message ?? 'Loading'} />}
      title={message}
      subtitle={subtitle}
    />
  );
}
