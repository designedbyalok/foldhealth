import { Component } from 'react';
import { ErrorState } from '../ErrorState/ErrorState';
import styles from './ErrorBoundary.module.css';

const changed = (a = [], b = []) => a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));

/**
 * ErrorBoundary: catches a render error in its children and shows a
 * recoverable message instead of unmounting the whole page.
 *
 * @param {object}    props
 * @param {ReactNode} props.children
 * @param {Array}     [props.resetKeys] – when any value changes (a route, a
 *                                        selected patient), the boundary
 *                                        clears and renders children again
 * @param {(error: Error, reset: () => void) => ReactNode} [props.fallback]
 *                                      – custom fallback; defaults to ErrorState
 *                                        with Try Again
 * @param {string}    [props.title]     – default fallback heading
 * @param {string}    [props.message]   – default fallback text
 * @param {(error: Error, info: object) => void} [props.onError] – for logging
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev) {
    if (this.state.error && changed(prev.resetKeys, this.props.resetKeys)) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className={styles.fallback} role="alert">
        <ErrorState
          icon="solar:danger-triangle-linear"
          title={this.props.title || 'Something went wrong'}
          message={this.props.message || 'This part of the page could not be shown. Try again, or come back in a moment.'}
          onRetry={this.reset}
        />
      </div>
    );
  }
}
