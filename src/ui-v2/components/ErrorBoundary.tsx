import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 items-center justify-center bg-background p-6">
          <div className="max-w-md text-center">
            <p className="mb-2 font-heading text-lg font-bold uppercase tracking-wider text-foreground">
              Algo salió mal
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Ocurrió un error inesperado. Presioná F5 para recargar la aplicación.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Recargar (F5)
            </button>
          </div>
        </div>
      );
    }

    return <div className="flex min-h-0 flex-1 flex-col">{this.props.children}</div>;
  }
}
