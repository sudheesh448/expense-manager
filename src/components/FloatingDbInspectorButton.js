import React, { useState, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Modal, Platform, Animated, PanResponder, Dimensions } from 'react-native';
import { Database, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import SafeDatabaseInspector from '../screens/DatabaseInspector';

const { width, height } = Dimensions.get('window');

const FloatingDbInspectorButton = () => {
  const { theme, fs } = useTheme();
  const [visible, setVisible] = useState(false);
  
  // DRAG LOGIC
  const pan = useRef(new Animated.ValueXY({ 
    x: width - 70, 
    y: height - 150 
  })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only set responder if there's significant movement (prevents blocking simple taps)
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.floatingBtnContainer,
          {
            transform: pan.getTranslateTransform(),
            zIndex: 9999,
          }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.floatingBtn,
            { backgroundColor: theme.primary }
          ]}
          onPress={() => setVisible(true)}
          activeOpacity={0.8}
        >
          <Database color="#FFF" size={24} />
        </TouchableOpacity>
      </Animated.View>

      <SafeDatabaseInspector 
        visible={visible} 
        onClose={() => setVisible(false)} 
        theme={theme} 
        fs={fs} 
      />
    </>
  );
};

const styles = StyleSheet.create({
  floatingBtnContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
  },
  floatingBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});

export default FloatingDbInspectorButton;
