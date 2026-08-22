import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authErrorMessage } from '@/lib/errors';
import { mobileApi } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { colors, typography } from '@/theme';

const LoginFormSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginForm = z.infer<typeof LoginFormSchema>;

export default function LoginScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ role?: string }>();
  const expectedRole = params.role === 'BARBER' ? 'BARBER' : 'CLIENT';
  const setAuth = useAuthStore((state) => state.setAuth);
  const { control, formState, handleSubmit, setError } = useForm<LoginForm>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(LoginFormSchema),
  });

  const onSubmit = async (values: LoginForm): Promise<void> => {
    try {
      const response = await mobileApi.auth.login(values);
      if (response.user.userType !== expectedRole) {
        setError('root', {
          message:
            expectedRole === 'BARBER'
              ? 'This is a customer account. Use customer sign in instead.'
              : 'This is a barber account. Use barber sign in instead.',
        });
        return;
      }
      await setAuth(response.user, response.accessToken, response.refreshToken);
      router.replace(
        response.user.userType === 'BARBER' ? '/(barber)/today' : '/(client)/discover',
      );
    } catch (error) {
      setError('root', { message: authErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title={expectedRole === 'BARBER' ? 'Barber sign in' : 'Customer sign in'}
        subtitle={
          expectedRole === 'BARBER' ? 'Open your business workspace.' : 'Manage your bookings.'
        }
      />
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
        loading={formState.isSubmitting}
        title="Sign in"
        onPress={handleSubmit(onSubmit)}
      />
      <Button
        title="Forgot password?"
        onPress={() => router.push('/(auth)/forgot-password')}
        variant="ghost"
      />
      <Button
        title={`Create ${expectedRole === 'BARBER' ? 'barber' : 'customer'} account`}
        onPress={() => router.push('/(auth)/register?role=' + expectedRole)}
        variant="secondary"
      />
      <Button
        title={expectedRole === 'BARBER' ? 'Customer sign in' : 'Barber sign in'}
        onPress={() =>
          router.replace('/(auth)/login?role=' + (expectedRole === 'BARBER' ? 'CLIENT' : 'BARBER'))
        }
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
