import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { ONBOARDING_KEY } from './onboarding';

type Target = '/(tabs)' | '/(auth)/login' | '/onboarding' | null;

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => setOnboarded(val === '1'));
  }, []);

  // Wait for both checks: visible activity, never a silent black screen.
  if (authLoading || onboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#58A6FF" size="large" />
      </View>
    );
  }

  let target: Target;
  if (!onboarded)  target = '/onboarding';
  else if (!user)  target = '/(auth)/login';
  else             target = '/(tabs)';

  return <Redirect href={target} />;
}
