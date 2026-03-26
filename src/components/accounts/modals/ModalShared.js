import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const FormSection = ({ title, icon: Icon, children, theme, fs }) => {
  return (
    <View style={[styles.section, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <View style={styles.sectionHeader}>
        {Icon && <Icon size={16} color={theme.primary} style={{ marginRight: 8 }} />}
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(13) }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

export const styles = StyleSheet.create({
  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  modalTitle: { fontWeight: '800', letterSpacing: -0.5 },
  section: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldLabel: { fontWeight: '700', marginBottom: 6, marginTop: 4 },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  saveBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 32, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: 'white', fontWeight: '800', letterSpacing: 1 },
  premiumSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  summaryCard: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryDivider: { height: 1.5, marginVertical: 12, borderRadius: 1 },
});
