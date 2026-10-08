import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export class VisualizationBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; onFailure?: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onFailure?.(error.message); }
  render() {
    return this.state.failed ? this.props.fallback ?? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#221c35' }]} /> : this.props.children;
  }
}
