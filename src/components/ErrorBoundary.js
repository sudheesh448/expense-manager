import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || 'An unexpected error occurred.';

    return (
      <View style={styles.container}>
        <AlertTriangle color="#ef4444" size={52} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{message}</Text>

        <ScrollView style={styles.stack} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.stackText}>
            {this.state.errorInfo?.componentStack || ''}
          </Text>
        </ScrollView>

        <TouchableOpacity style={styles.btn} onPress={this.handleReset}>
          <RefreshCw color="white" size={18} />
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#fff8f8', alignItems: 'center',
    justifyContent: 'center', padding: 24,
  },
  title: {
    fontSize: 22, fontWeight: 'bold', color: '#991b1b',
    marginTop: 16, marginBottom: 8,
  },
  message: {
    fontSize: 15, color: '#7f1d1d', textAlign: 'center', marginBottom: 16,
  },
  stack: {
    maxHeight: 180, width: '100%',
    backgroundColor: '#fee2e2', borderRadius: 10, marginBottom: 24,
  },
  stackText: { fontSize: 11, color: '#991b1b', fontFamily: 'monospace' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ef4444', paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 12,
  },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
