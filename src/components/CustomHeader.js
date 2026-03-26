import { User } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CustomHeader = ({
  title,
  leftComponent,
  centerComponent,
  rightComponent,
  showProfile = false,
  onProfilePress,
  theme,
  fs
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.header,
      {
        backgroundColor: theme.surface,
        borderBottomColor: theme.border,
        paddingTop: insets.top + (insets.top > 0 ? 4 : 12)
      }
    ]}>
      <View style={styles.headerLeft}>
        {showProfile && (
          <TouchableOpacity
            onPress={onProfilePress}
            style={[styles.profileBtn, { backgroundColor: theme.primary }]}
          >
            <User color="#FFF" size={20} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {leftComponent}
        {centerComponent ? centerComponent : (
          <Text style={[styles.headerTitle, { color: theme.text, fontSize: fs(24) }]} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
      {rightComponent && (
        <View style={styles.headerRight}>
          {rightComponent}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, // Creates an ultra-fine, premium border
    zIndex: 10,
    minHeight: 56, // Modern tap-target height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 0, // removed arbitrary offset since padding is handled globally
  },
  headerTitle: {
    fontWeight: '800',
    letterSpacing: -0.6,
    marginLeft: 12
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
});

export default CustomHeader;
