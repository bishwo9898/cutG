import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { colors, typography } from '@/theme';

export default function ForgotPasswordScreen(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sendCode = async (): Promise<void> => {
    try {
      await mobileApi.auth.forgotPassword(email);
      setSent(true);
      setMessage('Reset code sent if the email exists. Check API logs locally.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const reset = async (): Promise<void> => {
    try {
      await mobileApi.auth.resetPassword({ email, newPassword, resetCode });
      setMessage('Password reset. You can sign in now.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Reset password"
        subtitle="Use the development reset code from API logs."
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
          title="Send Reset Code"
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
