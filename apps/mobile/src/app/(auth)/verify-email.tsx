import { useSignUp } from '@clerk/clerk-expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import { clerkErrorMessage } from '@/lib/clerkErrorMessage';
import { colors, typography } from '@/theme';

export default function VerifyEmailScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ email?: string; role?: string }>();
  const email = params.email ?? '';
  const role = params.role === 'BARBER' ? 'BARBER' : 'CLIENT';
  const { isLoaded, signUp, setActive } = useSignUp();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    if (!isLoaded) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status !== 'complete' || result.createdSessionId === null) {
        setMessage('That code did not work. Please try again.');
        return;
      }

      await setActive({ session: result.createdSessionId });
      await mobileApi.auth.sync(role);
      router.replace(role === 'BARBER' ? '/(barber)/today' : '/(client)/discover');
    } catch (error) {
      setMessage(clerkErrorMessage(error, 'Verification failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Verify email"
        subtitle={email.length > 0 ? email : 'Enter the code from your email.'}
      />
      <Input
        keyboardType="number-pad"
        label="6-digit code"
        maxLength={6}
        onChangeText={setCode}
        value={code}
      />
      {message !== null ? <Text style={styles.error}>{message}</Text> : null}
      <Button
        disabled={loading || code.length !== 6}
        title={loading ? 'Verifying...' : 'Verify'}
        onPress={() => {
          void submit();
        }}
      />
      <Button
        title="Back to sign in"
        onPress={() => router.replace('/(auth)/login?role=' + role)}
        variant="ghost"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.bodySmall,
    color: colors.error,
  },
});
