import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export class VisualizationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#221c35' }]} /> : this.props.children;
  }
}
