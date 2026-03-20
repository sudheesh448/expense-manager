import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function DatePicker({ date, onChange, label, mode = 'date', dateFormat, containerStyle, pickerStyle }) {
  const [show, setShow] = useState(false);
  const { theme } = useTheme();

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShow(Platform.OS === 'ios');
    onChange(currentDate);
  };

  const togglePicker = () => {
    setShow(!show);
  };

  const displayDate = () => {
    if (dateFormat) return format(date, dateFormat);
    return mode === 'date' ? format(date, 'PPP') : format(date, 'p');
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>}
      <TouchableOpacity style={[styles.pickerButton, pickerStyle, { backgroundColor: theme.surface, borderColor: theme.borderDark }]} onPress={togglePicker}>
        <Calendar size={18} color={theme.textMuted} style={styles.icon} />
        <Text style={[styles.dateText, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
          {displayDate()}
        </Text>
      </TouchableOpacity>
      
      {show && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode={mode}
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  icon: {
    marginRight: 10,
  },
  dateText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
});
