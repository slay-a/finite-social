import { Stack } from 'expo-router';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { SubscriptionProvider } from '../src/context/SubscriptionContext';

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
