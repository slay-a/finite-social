import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { SubscriptionProvider } from '../src/context/SubscriptionContext';

// Any render crash shows its message and a retry instead of a blank screen.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
      <Text style={{ color: '#E6EDF3', fontSize: 17, fontWeight: '700' }}>Something went wrong</Text>
      <Text style={{ color: '#8B949E', fontSize: 13, textAlign: 'center' }} numberOfLines={6}>
        {String(error?.message ?? error)}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: '#58A6FF', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 }}
      >
        <Text style={{ color: '#0A0A0F', fontWeight: '700' }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <AppProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AppProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
