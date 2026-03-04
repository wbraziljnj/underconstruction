import { useCallback, useRef, useState } from 'react';

type State = {
  open: boolean;
  title: string;
  confirmLabel: string;
  danger: boolean;
};

export function useConfirmPassword() {
  const [state, setState] = useState<State>({
    open: false,
    title: 'Confirmar senha',
    confirmLabel: 'Confirmar',
    danger: false
  });

  const resolverRef = useRef<((value: string) => void) | null>(null);
  const rejectRef = useRef<((reason?: any) => void) | null>(null);

  const request = useCallback((opts?: Partial<Omit<State, 'open'>>): Promise<string> => {
    setState({
      open: true,
      title: opts?.title ?? 'Confirmar senha',
      confirmLabel: opts?.confirmLabel ?? 'Confirmar',
      danger: opts?.danger ?? false
    });
    return new Promise<string>((resolve, reject) => {
      resolverRef.current = resolve;
      rejectRef.current = reject;
    });
  }, []);

  const cancel = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    rejectRef.current?.(new Error('cancelled'));
    resolverRef.current = null;
    rejectRef.current = null;
  }, []);

  const confirm = useCallback((password: string) => {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.(password);
    resolverRef.current = null;
    rejectRef.current = null;
  }, []);

  return { state, request, cancel, confirm };
}

