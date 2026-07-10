import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { colors, typography } from '@/theme';

export default function VerifyEmailScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    setLoading(true);
    setMessage(null);
    try {
      await mobileApi.auth.verifyEmail(email, code);
      router.replace('/(auth)/login');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Verify email"
        subtitle={email.length > 0 ? email : 'Enter the code from the API logs.'}
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
        onPress={() => router.replace('/(auth)/login')}
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
