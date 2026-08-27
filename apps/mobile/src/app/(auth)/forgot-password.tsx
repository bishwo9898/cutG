import { getClerkInstance, useSignIn } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { clerkErrorMessage } from '@/lib/clerkErrorMessage';
import { colors, typography } from '@/theme';

export default function ForgotPasswordScreen(): React.ReactElement {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sendCode = async (): Promise<void> => {
    if (!isLoaded) {
      return;
    }
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setSent(true);
      setMessage('If an account exists for this email, a reset code is on its way.');
    } catch (error) {
      setMessage(clerkErrorMessage(error, 'We could not send a reset code.'));
    }
  };

  const reset = async (): Promise<void> => {
    if (!isLoaded) {
      return;
    }
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      });

      if (result.status !== 'complete' || result.createdSessionId === null) {
        setMessage('That code did not work. Please try again.');
        return;
      }

      await setActive({ session: result.createdSessionId });
      setMessage('Password reset. Redirecting...');

      const userType = getClerkInstance().user?.publicMetadata?.userType;
      router.replace(
        userType === 'BARBER'
          ? '/(barber)/today'
          : userType === 'CLIENT'
            ? '/(client)/discover'
            : '/(auth)/welcome',
      );
    } catch (error) {
      setMessage(clerkErrorMessage(error, 'Reset failed.'));
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Reset password"
        subtitle="We’ll email you a secure code to choose a new password."
      />
      <Input
        autoCapitalize="none"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        value={email}
      />
      {sent ? (
        <>
          <Input
            keyboardType="number-pad"
            label="Reset code"
            onChangeText={setResetCode}
            value={resetCode}
          />
          <Input
            label="New password"
            onChangeText={setNewPassword}
            secureTextEntry
            value={newPassword}
          />
          <Button
            title="Confirm reset"
            onPress={() => {
              void reset();
            }}
          />
        </>
      ) : (
        <Button
          title="Send reset code"
          onPress={() => {
            void sendCode();
          }}
        />
      )}
      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
