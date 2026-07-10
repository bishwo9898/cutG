import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { errorMessage } from '@/lib/errors';
import { mobileApi } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { colors, typography } from '@/theme';

const LoginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginForm = z.infer<typeof LoginFormSchema>;

export default function LoginScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ role?: string }>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { control, formState, handleSubmit, setError } = useForm<LoginForm>({
    defaultValues: {
      email: params.role === 'BARBER' ? 'barber1@example.com' : 'client1@example.com',
      password: 'password123',
    },
    resolver: zodResolver(LoginFormSchema),
  });

  const onSubmit = async (values: LoginForm): Promise<void> => {
    try {
      const response = await mobileApi.auth.login(values);
      await setAuth(response.user, response.accessToken, response.refreshToken);
      router.replace(
        response.user.userType === 'BARBER' ? '/(barber)/today' : '/(client)/discover',
      );
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  };

  return (
    <Screen>
      <ScreenHeader showBack title="Sign in" subtitle="Use a client or barber account." />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            value={field.value}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <Input
            label="Password"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            secureTextEntry
            value={field.value}
            error={fieldState.error?.message}
          />
        )}
      />
      {formState.errors.root?.message !== undefined ? (
        <Text style={styles.error}>{formState.errors.root.message}</Text>
      ) : null}
      <Button
        disabled={formState.isSubmitting}
        title={formState.isSubmitting ? 'Signing in...' : 'Sign In'}
        onPress={handleSubmit(onSubmit)}
      />
      <Button
        title="Forgot password?"
        onPress={() => router.push('/(auth)/forgot-password')}
        variant="ghost"
      />
      <Button
        title="Create an account"
        onPress={() => router.push('/(auth)/role-select')}
        variant="secondary"
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
